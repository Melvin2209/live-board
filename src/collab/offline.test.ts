import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { createElement, listElements } from "@/board/model";
import { connectionStatus } from "./useConnectionStatus";

describe("local (IndexedDB) persistence", () => {
  it("restores a board without any network, e.g. after an offline reload", async () => {
    const first = new Y.Doc();
    const firstLocal = new IndexeddbPersistence("live-board:offline-test", first);
    await firstLocal.whenSynced;
    createElement(first, { type: "sticky", x: 3, y: 4, text: "written offline" });
    await new Promise((r) => setTimeout(r, 50)); // IndexedDB writes are async
    await firstLocal.destroy();

    const reloaded = new Y.Doc();
    const local = new IndexeddbPersistence("live-board:offline-test", reloaded);
    await local.whenSynced;
    expect(listElements(reloaded)[0]).toMatchObject({ text: "written offline", x: 3 });
    await local.destroy();
  });
});

describe("connectionStatus", () => {
  it("maps socket and browser state to a user-facing status", () => {
    expect(connectionStatus("connected", true)).toBe("online");
    expect(connectionStatus("connecting", true)).toBe("connecting");
    expect(connectionStatus("disconnected", false)).toBe("offline");
  });
});
