import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createUndoManager } from "./history";
import { createElement, deleteElements, listElements, moveElements, setText, updateElement } from "./model";

/** Forward every update of `from` to `to`, tagged as a remote change. */
function connect(a: Y.Doc, b: Y.Doc) {
  a.on("update", (update: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(b, update, "remote"));
  b.on("update", (update: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(a, update, "remote"));
}

describe("undo / redo", () => {
  it("undoes and redoes local changes", () => {
    const doc = new Y.Doc();
    const undo = createUndoManager(doc, 0);
    const id = createElement(doc, { type: "sticky", x: 0, y: 0 });
    moveElements(doc, [id], 10, 10);

    undo.undo();
    expect(listElements(doc)[0]).toMatchObject({ x: 0, y: 0 });
    undo.undo();
    expect(listElements(doc)).toEqual([]);
    undo.redo();
    undo.redo();
    expect(listElements(doc)[0]).toMatchObject({ x: 10, y: 10 });
  });

  it("restores a deleted element with its text", () => {
    const doc = new Y.Doc();
    const id = createElement(doc, { type: "sticky", x: 0, y: 0, text: "keep me" });
    const undo = createUndoManager(doc, 0);
    deleteElements(doc, [id]);
    undo.undo();
    expect(listElements(doc)[0]).toMatchObject({ id, text: "keep me" });
  });

  it("groups rapid changes into one step", () => {
    const doc = new Y.Doc();
    const id = createElement(doc, { type: "sticky", x: 0, y: 0 });
    const undo = createUndoManager(doc, 10_000);
    for (let i = 0; i < 20; i++) moveElements(doc, [id], 1, 0); // like a drag
    expect(listElements(doc)[0].x).toBe(20);
    undo.undo();
    expect(listElements(doc)[0].x).toBe(0);
  });

  it("never undoes a collaborator's changes", () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();
    connect(alice, bob);
    const aliceUndo = createUndoManager(alice, 0);

    const id = createElement(alice, { type: "sticky", x: 0, y: 0 });
    updateElement(bob, id, { color: "#f9a8d4" }); // Bob recolors
    moveElements(alice, [id], 100, 0); // Alice moves

    aliceUndo.undo(); // reverts Alice's move only
    expect(listElements(alice)[0]).toMatchObject({ x: 0, color: "#f9a8d4" });
    expect(listElements(bob)).toEqual(listElements(alice));

    createElement(bob, { type: "rect", x: 5, y: 5, id: "bobs" });
    aliceUndo.undo(); // reverts Alice's creation; Bob's rect stays
    expect(listElements(alice).map((e) => e.id)).toEqual(["bobs"]);
    expect(listElements(bob).map((e) => e.id)).toEqual(["bobs"]);
  });

  it("undoes typing", () => {
    const doc = new Y.Doc();
    const id = createElement(doc, { type: "text", x: 0, y: 0 });
    const undo = createUndoManager(doc, 0);
    setText(doc, id, "hello");
    undo.undo();
    expect(listElements(doc)[0].text).toBe("");
  });
});
