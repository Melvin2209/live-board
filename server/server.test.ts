import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { createElement, listElements, moveElements, updateElement } from "../src/board/model";
import { startServer, type RunningServer } from "./server";

/** Poll until `check` passes (network sync is asynchronous). */
async function eventually(check: () => void, timeout = 3000) {
  const start = Date.now();
  for (;;) {
    try {
      return check();
    } catch (err) {
      if (Date.now() - start > timeout) throw err;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

describe("sync server", () => {
  let dir: string;
  let dbPath: string;
  let server: RunningServer;
  const providers: WebsocketProvider[] = [];

  function connect(boardId: string, doc = new Y.Doc()) {
    const provider = new WebsocketProvider(`ws://localhost:${server.port}`, boardId, doc, {
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
      disableBc: true, // force the traffic through the server
    });
    providers.push(provider);
    return { doc, provider };
  }

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "live-board-server-"));
    dbPath = path.join(dir, "db.sqlite");
    server = await startServer({ port: 0, dbPath, saveDebounceMs: 10 });
  });

  afterEach(() => providers.splice(0).forEach((p) => p.destroy()));

  afterAll(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("syncs edits between two clients in real time", async () => {
    const alice = connect("sync-test");
    const bob = connect("sync-test");
    const id = createElement(alice.doc, { type: "sticky", x: 0, y: 0, text: "hi" });
    await eventually(() => expect(listElements(bob.doc)).toHaveLength(1));

    moveElements(bob.doc, [id], 40, 0);
    await eventually(() => expect(listElements(alice.doc)[0].x).toBe(40));
  });

  it("shares presence (awareness) between clients", async () => {
    const alice = connect("presence-test");
    const bob = connect("presence-test");
    alice.provider.awareness.setLocalStateField("user", { name: "Alice" });
    await eventually(() => {
      const names = [...bob.provider.awareness.getStates().values()].map((s) => s.user?.name);
      expect(names).toContain("Alice");
    });

    // Alice leaves: her presence disappears for Bob without waiting for a timeout.
    alice.provider.destroy();
    await eventually(() => {
      const names = [...bob.provider.awareness.getStates().values()].map((s) => s.user?.name);
      expect(names).not.toContain("Alice");
    });
  });

  it("keeps boards isolated from each other", async () => {
    const a = connect("room-a");
    const b = connect("room-b");
    createElement(a.doc, { type: "rect", x: 0, y: 0 });
    await eventually(() => expect(a.provider.synced).toBe(true));
    await new Promise((r) => setTimeout(r, 100));
    expect(listElements(b.doc)).toEqual([]);
  });

  it("persists boards across a server restart", async () => {
    const alice = connect("persist-test");
    createElement(alice.doc, { type: "sticky", x: 7, y: 7, text: "survives restart" });
    await eventually(() => expect(alice.provider.synced).toBe(true));
    await new Promise((r) => setTimeout(r, 50)); // let the update reach the server
    alice.provider.destroy();

    await server.close();
    server = await startServer({ port: 0, dbPath, saveDebounceMs: 10 });

    const late = connect("persist-test");
    await eventually(() => expect(listElements(late.doc)[0]).toMatchObject({ text: "survives restart", x: 7 }));
  });

  it("merges edits made offline once the client reconnects", async () => {
    const alice = connect("offline-test");
    const bob = connect("offline-test");
    const id = createElement(alice.doc, { type: "sticky", x: 0, y: 0, text: "plan" });
    await eventually(() => expect(listElements(bob.doc)).toHaveLength(1));

    bob.provider.disconnect(); // Bob loses the network
    moveElements(bob.doc, [id], 100, 0);
    createElement(bob.doc, { type: "rect", x: 0, y: 0, id: "made-offline" });
    updateElement(alice.doc, id, { color: "#86efac" }); // Alice keeps working online
    await new Promise((r) => setTimeout(r, 100));
    expect(listElements(alice.doc)).toHaveLength(1); // Bob's edits did not reach her

    bob.provider.connect(); // back online: both sides exchange what they missed
    await eventually(() => {
      expect(listElements(alice.doc)).toHaveLength(2);
      expect(listElements(alice.doc)).toEqual(listElements(bob.doc));
      expect(listElements(bob.doc).find((e) => e.id === id)).toMatchObject({ x: 100, color: "#86efac" });
    });
  });

  it("rejects invalid board ids", async () => {
    const ws = new WebSocket(`ws://localhost:${server.port}/Not%20Valid!`);
    const code = await new Promise((resolve) => ws.on("error", () => resolve("rejected")));
    expect(code).toBe("rejected");
  });
});
