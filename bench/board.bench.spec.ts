import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { expect, test, type Page } from "@playwright/test";
import { openBoard, uniqueBoardId } from "../e2e/helpers";
import { recordFrames, type FrameStats } from "./frames";

/**
 * Performance benchmark: a board with 500 elements, all visible on screen.
 * Run with `npm run bench`. Results land in bench-results/.
 */

const COUNT = Number(process.env.BENCH_ELEMENTS ?? 500);
/** e.g. 4 = simulate a CPU 4x slower (mid-range laptop / phone) on the measured page. */
const CPU_THROTTLE = Number(process.env.BENCH_CPU_THROTTLE ?? 1);
const VIEWPORT = { width: 1280, height: 800 };
const ZOOM_OUT_CLICKS = 8; // 1.2^-8 ≈ 23 %: the whole 25x20 grid fits on screen
const SCALE = Math.pow(1.2, -ZOOM_OUT_CLICKS);

// Pick elements near the middle of the seeded grid (same layout as seedBoard).
const COLS = Math.ceil(Math.sqrt(COUNT * 1.25));
const CENTER = Math.floor(Math.ceil(COUNT / COLS) / 2) * COLS + Math.floor(COLS / 2);
const LOCAL_ID = `seed-${CENTER + 2}`;
const REMOTE_ID = `seed-${CENTER - 2 * COLS - 3}`;

/** Screen position of a world point after zooming out around the screen center. */
function toScreen(x: number, y: number) {
  const cx = VIEWPORT.width / 2;
  const cy = VIEWPORT.height / 2;
  return { x: x * SCALE + cx * (1 - SCALE), y: y * SCALE + cy * (1 - SCALE) };
}

async function elementCenter(page: Page, id: string) {
  const el = await page.evaluate(
    (id) => (window.__liveBoard!.doc.getMap("elements").get(id) as { toJSON(): { x: number; y: number; width: number; height: number } }).toJSON(),
    id,
  );
  return toScreen(el.x + el.width / 2, el.y + el.height / 2);
}

async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number, steps: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
  }
  await page.mouse.up();
}

test(`board stays smooth with ${COUNT} elements`, async ({ browser }) => {
  const results: Record<string, FrameStats | number> = {};
  const boardId = uniqueBoardId("bench");
  const alice = await openBoard(browser, boardId, "Alice");
  const { page } = alice;
  await page.setViewportSize(VIEWPORT);
  if (CPU_THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
  }

  // 1. Create the elements and wait until they are drawn.
  results["seed + first render (ms)"] = await page.evaluate(async (count) => {
    const start = performance.now();
    window.__liveBoard!.seed(count);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Math.round(performance.now() - start);
  }, COUNT);
  await expect(page.getByTestId("element-count")).toHaveText(`${COUNT} elements`);

  for (let i = 0; i < ZOOM_OUT_CLICKS; i++) await page.getByTestId("zoom-out").click();
  await page.mouse.move(5, 400); // park the cursor outside the grid
  await page.waitForTimeout(300);

  // 2. Idle baseline.
  results.idle = await recordFrames(page, () => page.waitForTimeout(1000));

  // 3. Pan with the trackpad / wheel.
  results.pan = await recordFrames(page, async () => {
    for (let i = 0; i < 60; i++) await page.mouse.wheel(i < 30 ? 12 : -12, i < 30 ? 8 : -8);
  });

  // 4. Zoom in and out around the cursor (ctrl + wheel).
  results.zoom = await recordFrames(page, async () => {
    await page.mouse.move(640, 400);
    await page.keyboard.down("Control");
    for (let i = 0; i < 60; i++) await page.mouse.wheel(0, i < 30 ? -10 : 10);
    await page.keyboard.up("Control");
  });
  await page.getByTestId("zoom-reset").click();
  for (let i = 0; i < ZOOM_OUT_CLICKS; i++) await page.getByTestId("zoom-out").click();

  // 5. Drag one element across the board.
  const start = await elementCenter(page, LOCAL_ID);
  results.drag = await recordFrames(page, () => drag(page, start, 200, 120, 90));
  expect((await elementCenter(page, LOCAL_ID)).x).toBeCloseTo(start.x + 200, 0);

  // 6. A collaborator drags elements while we watch: the cost of remote updates.
  const bob = await openBoard(browser, boardId, "Bob");
  await bob.page.setViewportSize(VIEWPORT);
  await expect(bob.page.getByTestId("element-count")).toHaveText(`${COUNT} elements`);
  for (let i = 0; i < ZOOM_OUT_CLICKS; i++) await bob.page.getByTestId("zoom-out").click();
  const bobStart = await elementCenter(bob.page, REMOTE_ID);
  results["remote drag"] = await recordFrames(page, () => drag(bob.page, bobStart, -150, 100, 90));
  await expect.poll(async () => Math.round((await elementCenter(page, REMOTE_ID)).x)).toBe(Math.round(bobStart.x - 150));

  // 7. Time for a newcomer to load the board from the server.
  const carol = await browser.newContext({ viewport: VIEWPORT });
  const carolPage = await carol.newPage();
  await carolPage.goto(`/b/${boardId}`);
  await expect(carolPage.getByTestId("element-count")).toHaveText(`${COUNT} elements`);
  results["load from server (ms)"] = await carolPage.evaluate(() => Math.round(performance.now()));

  // ---- report ----
  const rows = Object.entries(results).map(([name, r]) =>
    typeof r === "number"
      ? `| ${name} | ${r} | | | | |`
      : `| ${name} | ${r.fps} | ${r.p50} | ${r.p95} | ${r.worst} | ${r.longTasks} |`,
  );
  const report = [
    `Elements: ${COUNT}, CPU throttling ${CPU_THROTTLE}x, viewport ${VIEWPORT.width}x${VIEWPORT.height}, headless Chromium, ${os.cpus().length} vCPU (${os.cpus()[0]?.model ?? "unknown"})`,
    "",
    "| Scenario | FPS / value | p50 frame (ms) | p95 frame (ms) | worst frame (ms) | long tasks |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
  console.log(`\n${report}\n`);
  mkdirSync("bench-results", { recursive: true });
  const suffix = `${COUNT}-cpu${CPU_THROTTLE}x`;
  writeFileSync(`bench-results/perf-${suffix}.md`, report + "\n");
  writeFileSync(`bench-results/perf-${suffix}.json`, JSON.stringify(results, null, 2));

  // Guard rails, generous enough for slow CI machines.
  for (const key of ["pan", "zoom", "drag", "remote drag"] as const) {
    expect((results[key] as FrameStats).p95, `${key} p95 frame time`).toBeLessThan(100 * CPU_THROTTLE);
  }
});
