import { expect, test } from "@playwright/test";
import { createWithTool, elementList, expectSameBoard, openBoard, uniqueBoardId } from "./helpers";

test.describe("two people editing the same board", () => {
  test("see each other's edits in real time", async ({ browser }) => {
    const boardId = uniqueBoardId("realtime");
    const alice = await openBoard(browser, boardId, "Alice");
    const bob = await openBoard(browser, boardId, "Bob");

    // Alice adds a sticky note and types in it.
    await createWithTool(alice.page, "sticky", 400, 300);
    await alice.page.keyboard.type("Ship the MVP");
    await alice.page.keyboard.press("Escape");

    await expect(bob.page.getByTestId("element-count")).toHaveText("1 element");
    await expect.poll(async () => (await elementList(bob.page))[0]?.text).toBe("Ship the MVP");

    // Bob drags it (sticky is 160x160, created centered-ish on the click).
    const before = (await elementList(alice.page))[0];
    await bob.page.mouse.move(400, 320);
    await bob.page.mouse.down();
    await bob.page.mouse.move(600, 420, { steps: 10 });
    await bob.page.mouse.up();

    await expect.poll(async () => (await elementList(alice.page))[0].x).toBe(before.x + 200);
    await expectSameBoard(alice.page, bob.page);
  });

  test("show the other person's name, cursor and presence", async ({ browser }) => {
    const boardId = uniqueBoardId("presence");
    const alice = await openBoard(browser, boardId, "Alice");
    const bob = await openBoard(browser, boardId, "Bob");

    await expect(alice.page.getByTestId("presence-user")).toHaveText(/Bob/);
    await expect(bob.page.getByTestId("presence-user")).toHaveText(/Alice/);

    await bob.page.mouse.move(500, 400, { steps: 5 });
    // The cursor is drawn on the canvas; check what Alice received through awareness.
    await expect
      .poll(() =>
        alice.page.evaluate(() => {
          const states = [...window.__liveBoard!.provider.awareness.getStates().values()];
          return states.find((s) => s.user?.name === "Bob")?.cursor ?? null;
        }),
      )
      .toEqual({ x: 500, y: 400 });

    await bob.context.close();
    await expect(alice.page.getByTestId("presence-user")).toHaveCount(0);
  });

  test("resolve concurrent edits without conflicts", async ({ browser }) => {
    const boardId = uniqueBoardId("conflicts");
    const alice = await openBoard(browser, boardId, "Alice");
    const bob = await openBoard(browser, boardId, "Bob");

    await createWithTool(alice.page, "sticky", 400, 300);
    await alice.page.keyboard.type("Agenda:");
    await alice.page.keyboard.press("Escape");
    await expect(bob.page.getByTestId("element-count")).toHaveText("1 element");

    // Both open the same note and type at the same time.
    await bob.page.mouse.dblclick(400, 320);
    await alice.page.mouse.dblclick(400, 320);
    await Promise.all([
      alice.page.keyboard.type(" budget", { delay: 30 }),
      bob.page.keyboard.type(" hiring", { delay: 30 }),
    ]);
    await alice.page.keyboard.press("Escape");
    await bob.page.keyboard.press("Escape");

    await expectSameBoard(alice.page, bob.page);
    const [note] = await elementList(alice.page);
    expect(note.text).toContain("budget");
    expect(note.text).toContain("hiring");

    // Simultaneously: Alice recolors, Bob moves. Both changes survive.
    await alice.page.mouse.click(400, 320);
    await bob.page.mouse.move(400, 320);
    await Promise.all([
      alice.page.getByTestId("color-#f9a8d4").click(),
      (async () => {
        await bob.page.mouse.down();
        await bob.page.mouse.move(500, 320, { steps: 5 });
        await bob.page.mouse.up();
      })(),
    ]);
    await expect.poll(async () => (await elementList(alice.page))[0]).toMatchObject({ color: "#f9a8d4", x: note.x + 100 });
    await expectSameBoard(alice.page, bob.page);
  });

  test("undo only reverts your own changes", async ({ browser }) => {
    const boardId = uniqueBoardId("undo");
    const alice = await openBoard(browser, boardId, "Alice");
    const bob = await openBoard(browser, boardId, "Bob");

    await createWithTool(alice.page, "rect", 300, 300);
    await createWithTool(bob.page, "ellipse", 700, 300);
    await expect(alice.page.getByTestId("element-count")).toHaveText("2 elements");

    await alice.page.keyboard.press("Escape");
    await alice.page.keyboard.press("ControlOrMeta+z");

    await expect(bob.page.getByTestId("element-count")).toHaveText("1 element");
    expect((await elementList(bob.page))[0].type).toBe("ellipse");

    await alice.page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(bob.page.getByTestId("element-count")).toHaveText("2 elements");
  });

  test("keep working offline and resync when the network is back", async ({ browser }) => {
    const boardId = uniqueBoardId("offline");
    const alice = await openBoard(browser, boardId, "Alice");
    const bob = await openBoard(browser, boardId, "Bob");

    await bob.context.setOffline(true);
    await expect(bob.page.getByTestId("connection-status")).toHaveAttribute("data-status", "offline");

    // Both keep editing while Bob is cut off.
    await createWithTool(bob.page, "sticky", 300, 300);
    await bob.page.keyboard.type("written offline");
    await bob.page.keyboard.press("Escape");
    await createWithTool(alice.page, "rect", 800, 300);

    await expect(bob.page.getByTestId("element-count")).toHaveText("1 element");
    await expect(alice.page.getByTestId("element-count")).toHaveText("1 element");

    await bob.context.setOffline(false);
    await expect(bob.page.getByTestId("connection-status")).toHaveAttribute("data-status", "online");
    await expect(alice.page.getByTestId("element-count")).toHaveText("2 elements");
    await expect(bob.page.getByTestId("element-count")).toHaveText("2 elements");
    await expectSameBoard(alice.page, bob.page);
  });
});

test.describe("sharing and persistence", () => {
  test("a shared link opens the same board, stored on the server", async ({ browser }) => {
    const boardId = uniqueBoardId("persist");
    const alice = await openBoard(browser, boardId, "Alice");
    await alice.context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await createWithTool(alice.page, "text", 400, 300);
    await alice.page.keyboard.type("Hello from the server");
    await alice.page.keyboard.press("Escape");

    await alice.page.getByTestId("share").click();
    await expect(alice.page.getByTestId("share")).toHaveText("Link copied!");
    const link = await alice.page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain(`/b/${boardId}`);

    // Wait until the server has the update, then everybody leaves.
    await expect
      .poll(() => alice.page.evaluate(() => window.__liveBoard!.provider.synced))
      .toBe(true);
    await alice.page.waitForTimeout(300);
    await alice.context.close();

    // A brand new browser (no local cache) opens the link later.
    const carol = await browser.newContext();
    const page = await carol.newPage();
    await page.goto(link);
    await expect(page.getByTestId("element-count")).toHaveText("1 element");
    await expect.poll(async () => (await elementList(page))[0]?.text).toBe("Hello from the server");
  });

  test("the home page creates a new board", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("new-board").click();
    await expect(page).toHaveURL(/\/b\/[a-z0-9]+$/);
    await expect(page.getByTestId("element-count")).toHaveText("0 elements");
  });
});
