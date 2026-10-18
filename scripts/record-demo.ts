/**
 * Records docs/demo.gif: two browsers (Alice and Bob) editing the same board.
 *
 * Needs the app running (`npm run build && npm start`), plus Python 3 with
 * Pillow and ffmpeg. Usage: `npx tsx scripts/record-demo.ts [baseUrl]`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const SIZE = { width: 760, height: 540 };
const boardId = `demo-${Date.now().toString(36)}`;

const browser = await chromium.launch();
async function open(name: string) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/b/${boardId}`);
  await page.getByTestId("user-name").fill(name);
  await page.getByTestId("user-name").press("Enter");
  await page.waitForSelector("[data-status=online]");
  return { context, page };
}
const alice = await open("Alice");
const bob = await open("Bob");

// Capture both pages continuously in the background.
const dir = mkdtempSync(path.join(tmpdir(), "live-board-demo-"));
let frame = 0;
let recording = true;
const startedAt = Date.now();
const recorder = (async () => {
  while (recording) {
    const id = String(frame++).padStart(4, "0");
    await Promise.all([
      alice.page.screenshot({ path: path.join(dir, `a-${id}.png`) }),
      bob.page.screenshot({ path: path.join(dir, `b-${id}.png`) }),
    ]);
  }
})();

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function glide(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 12 });
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.mouse.move(...from, { steps: 8 });
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 20 });
  await page.mouse.up();
}

await pause(400);
// Alice writes a sticky note.
await alice.page.getByTestId("tool-sticky").click();
await alice.page.mouse.click(220, 230);
await alice.page.keyboard.type("Sprint goals", { delay: 60 });
await alice.page.keyboard.press("Escape");
// Bob shows up with a rectangle, Alice watches his cursor.
await glide(bob.page, 450, 200);
await bob.page.getByTestId("tool-rect").click();
await bob.page.mouse.click(520, 200);
await bob.page.keyboard.press("Escape");
await bob.page.mouse.dblclick(520, 200);
await bob.page.keyboard.type("Design review", { delay: 60 });
await bob.page.keyboard.press("Escape");
await glide(alice.page, 400, 420);
// Bob moves Alice's note, Alice recolors it at the same time.
await alice.page.mouse.click(220, 260);
await Promise.all([drag(bob.page, [220, 260], [260, 330]), alice.page.getByTestId("color-#f9a8d4").click()]);
// Both type in the same note.
await pause(300);
await alice.page.mouse.dblclick(260, 330);
await bob.page.mouse.dblclick(260, 330);
await Promise.all([
  alice.page.keyboard.type("\n- ship v1", { delay: 70 }),
  bob.page.keyboard.type("\n- fix bugs", { delay: 70 }),
]);
await alice.page.keyboard.press("Escape");
await bob.page.keyboard.press("Escape");
// Bob goes offline, keeps working, comes back.
await bob.context.setOffline(true);
await bob.page.getByTestId("tool-ellipse").click();
await bob.page.mouse.click(560, 400);
await bob.page.keyboard.press("Escape");
await alice.page.getByTestId("tool-text").click();
await alice.page.mouse.click(130, 450);
await alice.page.keyboard.type("Offline? No problem.", { delay: 50 });
await alice.page.keyboard.press("Escape");
await pause(500);
await bob.context.setOffline(false);
await bob.page.waitForSelector("[data-status=online]");
await pause(1200);

recording = false;
await recorder;
const seconds = (Date.now() - startedAt) / 1000;
await browser.close();

// Compose Alice | Bob side by side, then encode a GIF with ffmpeg.
const compose = `
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1]
for a in sorted(glob.glob(os.path.join(d, "a-*.png"))):
    b = a.replace("a-", "b-")
    if not os.path.exists(b): continue
    A, B = Image.open(a), Image.open(b)
    out = Image.new("RGB", (A.width + B.width + 6, A.height + 30), "#1f2328")
    out.paste(A, (0, 30)); out.paste(B, (A.width + 6, 30))
    draw = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=15)
    draw.text((12, 6), "Browser 1 - Alice", fill="white", font=font)
    draw.text((A.width + 18, 6), "Browser 2 - Bob", fill="white", font=font)
    out.save(a.replace("a-", "f-"))
`;
writeFileSync(path.join(dir, "compose.py"), compose);
execFileSync("python3", [path.join(dir, "compose.py"), dir]);
mkdirSync("docs", { recursive: true });
const fps = Math.max(4, Math.round(frame / seconds));
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", String(fps), "-pattern_type", "glob", "-i", path.join(dir, "f-*.png"),
  "-vf", "scale=1100:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=none",
  "docs/demo.gif",
]);
const frames = execFileSync("sh", ["-c", `ls ${dir}/f-*.png`]).toString().trim().split("\n");
execFileSync("cp", [frames[frames.length - 1], "docs/screenshot.png"]);
rmSync(dir, { recursive: true, force: true });
console.log(`docs/demo.gif written (${frame} frames)`);
