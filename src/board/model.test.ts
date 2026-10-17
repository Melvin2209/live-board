import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  bringToFront,
  createElement,
  deleteElements,
  listElements,
  moveElements,
  setText,
  updateElement,
} from "./model";

/** Exchange all missing updates between two docs, like a network round-trip. */
function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

function clone(doc: Y.Doc): Y.Doc {
  const copy = new Y.Doc();
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc));
  return copy;
}

describe("board model", () => {
  it("creates elements with type defaults", () => {
    const doc = new Y.Doc();
    const id = createElement(doc, { type: "sticky", x: 10, y: 20, text: "hello" });
    expect(listElements(doc)).toEqual([
      { id, type: "sticky", x: 10, y: 20, width: 160, height: 160, color: "#fde68a", z: 1, text: "hello" },
    ]);
  });

  it("moves, updates and deletes elements", () => {
    const doc = new Y.Doc();
    const a = createElement(doc, { type: "rect", x: 0, y: 0 });
    const b = createElement(doc, { type: "ellipse", x: 100, y: 100 });

    moveElements(doc, [a, b], 5, -5);
    updateElement(doc, a, { color: "#ff0000", width: 50 });
    expect(listElements(doc).map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: a, x: 5, y: -5 },
      { id: b, x: 105, y: 95 },
    ]);
    expect(listElements(doc)[0]).toMatchObject({ color: "#ff0000", width: 50 });

    deleteElements(doc, [a]);
    expect(listElements(doc).map((e) => e.id)).toEqual([b]);
  });

  it("ignores operations on elements that no longer exist", () => {
    const doc = new Y.Doc();
    expect(() => {
      updateElement(doc, "missing", { x: 1 });
      moveElements(doc, ["missing"], 1, 1);
      setText(doc, "missing", "x");
      bringToFront(doc, "missing");
    }).not.toThrow();
  });

  it("brings an element to the front", () => {
    const doc = new Y.Doc();
    const a = createElement(doc, { type: "rect", x: 0, y: 0 });
    const b = createElement(doc, { type: "rect", x: 0, y: 0 });
    expect(listElements(doc).map((e) => e.id)).toEqual([a, b]);
    bringToFront(doc, a);
    expect(listElements(doc).map((e) => e.id)).toEqual([b, a]);
  });

  it("applies minimal text diffs", () => {
    const doc = new Y.Doc();
    const id = createElement(doc, { type: "text", x: 0, y: 0, text: "hello world" });
    setText(doc, id, "hello brave world");
    expect(listElements(doc)[0].text).toBe("hello brave world");
    setText(doc, id, "");
    expect(listElements(doc)[0].text).toBe("");
  });
});

describe("conflict resolution between two peers", () => {
  it("merges concurrent edits of different properties", () => {
    const alice = new Y.Doc();
    const id = createElement(alice, { type: "sticky", x: 0, y: 0 });
    const bob = clone(alice);

    updateElement(alice, id, { x: 300 }); // Alice moves it
    updateElement(bob, id, { color: "#f9a8d4" }); // Bob recolors it at the same time
    sync(alice, bob);

    for (const doc of [alice, bob]) {
      expect(listElements(doc)[0]).toMatchObject({ x: 300, color: "#f9a8d4" });
    }
  });

  it("converges when both peers write the same property", () => {
    const alice = new Y.Doc();
    const id = createElement(alice, { type: "sticky", x: 0, y: 0 });
    const bob = clone(alice);

    updateElement(alice, id, { x: 100 });
    updateElement(bob, id, { x: 200 });
    sync(alice, bob);

    // Which value wins is decided by Yjs (deterministically); what matters is
    // that both peers end up with the same one.
    expect(listElements(alice)).toEqual(listElements(bob));
    expect([100, 200]).toContain(listElements(alice)[0].x);
  });

  it("merges concurrent typing in the same text", () => {
    const alice = new Y.Doc();
    const id = createElement(alice, { type: "sticky", x: 0, y: 0, text: "buy milk" });
    const bob = clone(alice);

    setText(alice, id, "buy milk and eggs");
    setText(bob, id, "please buy milk");
    sync(alice, bob);

    expect(listElements(alice)[0].text).toBe("please buy milk and eggs");
    expect(listElements(bob)[0].text).toBe("please buy milk and eggs");
  });

  it("delete wins over a concurrent move", () => {
    const alice = new Y.Doc();
    const id = createElement(alice, { type: "rect", x: 0, y: 0 });
    const bob = clone(alice);

    deleteElements(alice, [id]);
    moveElements(bob, [id], 50, 50);
    sync(alice, bob);

    expect(listElements(alice)).toEqual([]);
    expect(listElements(bob)).toEqual([]);
  });

  it("keeps a stable order when two peers create elements concurrently", () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();
    createElement(alice, { type: "rect", x: 0, y: 0, id: "a" });
    createElement(bob, { type: "rect", x: 0, y: 0, id: "b" });
    sync(alice, bob);

    // Both got z = 1: the id tie-breaker makes the order identical everywhere.
    expect(listElements(alice).map((e) => e.id)).toEqual(["a", "b"]);
    expect(listElements(bob).map((e) => e.id)).toEqual(["a", "b"]);
  });
});
