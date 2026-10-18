import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export interface Peer {
  context: BrowserContext;
  page: Page;
}

export interface ElementJSON {
  type: string;
  x: number;
  y: number;
  color: string;
  text: string;
}

export function uniqueBoardId(name: string): string {
  return `e2e-${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Each peer gets its own browser context: separate storage, separate
 * IndexedDB, separate WebSocket. Exactly like two people on two machines.
 */
export async function openBoard(browser: Browser, boardId: string, name: string): Promise<Peer> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`/b/${boardId}`);
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-status", "online");
  await page.getByTestId("user-name").fill(name);
  await page.getByTestId("user-name").press("Enter");
  return { context, page };
}

/** Reads the shared document through the debug handle exposed by the app. */
export async function readElements(page: Page): Promise<Record<string, ElementJSON>> {
  return page.evaluate(() => window.__liveBoard!.doc.getMap("elements").toJSON());
}

export async function elementList(page: Page): Promise<(ElementJSON & { id: string })[]> {
  const elements = await readElements(page);
  return Object.entries(elements)
    .map(([id, el]) => ({ id, ...el }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Click on the canvas with a creation tool. Returns where the element's center ends up. */
export async function createWithTool(page: Page, tool: "sticky" | "rect" | "ellipse" | "text", x: number, y: number) {
  await page.getByTestId(`tool-${tool}`).click();
  await page.mouse.click(x, y);
}

export async function expectSameBoard(a: Page, b: Page) {
  await expect.poll(async () => JSON.stringify(await elementList(b))).toBe(JSON.stringify(await elementList(a)));
}
