import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createElement, listElements } from "../src/board/model";
import { BoardPersistence } from "./persistence";

describe("BoardPersistence", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  it("returns null for an unknown board", () => {
    const store = new BoardPersistence(":memory:");
    expect(store.load("nope")).toBeNull();
  });

  it("round-trips a Yjs snapshot through the database file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "live-board-"));
    dirs.push(dir);
    const dbPath = path.join(dir, "nested", "boards.sqlite");

    const doc = new Y.Doc();
    createElement(doc, { type: "sticky", x: 1, y: 2, text: "persisted" });
    const first = new BoardPersistence(dbPath);
    first.save("board-1", Y.encodeStateAsUpdate(doc));
    first.save("board-1", Y.encodeStateAsUpdate(doc)); // upsert, no duplicate key error
    first.close();

    // Reopen the file, as after a server restart.
    const second = new BoardPersistence(dbPath);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, second.load("board-1")!);
    expect(listElements(restored)).toEqual(listElements(doc));
    second.close();
  });
});
