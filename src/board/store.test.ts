import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createElement, deleteElements, moveElements, setText } from "./model";
import { BoardStore } from "./store";

describe("BoardStore", () => {
  it("reflects the document and notifies subscribers", () => {
    const doc = new Y.Doc();
    const store = new BoardStore(doc);
    const listener = vi.fn();
    store.subscribe(listener);

    const id = createElement(doc, { type: "sticky", x: 0, y: 0 });
    expect(store.getSnapshot().map((e) => e.id)).toEqual([id]);
    expect(listener).toHaveBeenCalledTimes(1);

    deleteElements(doc, [id]);
    expect(store.getSnapshot()).toEqual([]);
  });

  it("only rebuilds the elements that changed", () => {
    const doc = new Y.Doc();
    const a = createElement(doc, { type: "rect", x: 0, y: 0 });
    const b = createElement(doc, { type: "rect", x: 0, y: 0 });
    const store = new BoardStore(doc);
    const before = { a: store.get(a), b: store.get(b) };

    moveElements(doc, [a], 10, 0);
    expect(store.get(a)).not.toBe(before.a);
    expect(store.get(a)?.x).toBe(10);
    expect(store.get(b)).toBe(before.b); // same reference => React.memo skips it

    setText(doc, b, "hi");
    expect(store.get(b)?.text).toBe("hi");
  });

  it("picks up changes coming from a remote peer", () => {
    const remote = new Y.Doc();
    const local = new Y.Doc();
    const store = new BoardStore(local);
    createElement(remote, { type: "sticky", x: 1, y: 2, text: "from remote" });
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
    expect(store.getSnapshot()[0]).toMatchObject({ x: 1, y: 2, text: "from remote" });
  });
});
