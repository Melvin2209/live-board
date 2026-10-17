import * as Y from "yjs";
import { randomId } from "./ids";

/**
 * Board data model on top of Yjs.
 *
 * Shape of the shared document:
 *
 *   doc.getMap("elements"): Y.Map<id, Y.Map>
 *     each element map: { type, x, y, width, height, color, z, text: Y.Text }
 *
 * Every property lives in its own key of a Y.Map, so two people editing
 * different properties of the same element (one moves it, the other changes
 * its color) never conflict. When they edit the *same* property, Yjs picks
 * one value deterministically and every peer converges to it.
 * Text is a Y.Text, so concurrent typing is merged character by character.
 */

export type ElementType = "sticky" | "rect" | "ellipse" | "text";

export interface BoardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  /** Stacking order. Ties are broken by id so every peer draws the same order. */
  z: number;
  text: string;
}

export type ElementPatch = Partial<Pick<BoardElement, "x" | "y" | "width" | "height" | "color">>;

/**
 * Transaction origin for changes made by the local user.
 * The UndoManager only tracks this origin, so undo never reverts other people's work.
 */
export const LOCAL_ORIGIN = Symbol("local-user");

export const DEFAULTS: Record<ElementType, { width: number; height: number; color: string }> = {
  sticky: { width: 160, height: 160, color: "#fde68a" },
  rect: { width: 180, height: 120, color: "#93c5fd" },
  ellipse: { width: 160, height: 120, color: "#86efac" },
  text: { width: 220, height: 40, color: "#1f2328" },
};

export function getElementsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap("elements");
}

export function readElement(id: string, map: Y.Map<unknown>): BoardElement {
  const text = map.get("text");
  return {
    id,
    type: map.get("type") as ElementType,
    x: map.get("x") as number,
    y: map.get("y") as number,
    width: map.get("width") as number,
    height: map.get("height") as number,
    color: map.get("color") as string,
    z: map.get("z") as number,
    text: text instanceof Y.Text ? text.toString() : "",
  };
}

export function compareByZ(a: BoardElement, b: BoardElement): number {
  return a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function listElements(doc: Y.Doc): BoardElement[] {
  const out: BoardElement[] = [];
  getElementsMap(doc).forEach((map, id) => out.push(readElement(id, map)));
  return out.sort(compareByZ);
}

function maxZ(doc: Y.Doc): number {
  let max = 0;
  getElementsMap(doc).forEach((map) => {
    max = Math.max(max, map.get("z") as number);
  });
  return max;
}

export interface NewElement {
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  text?: string;
  id?: string;
}

export function createElement(doc: Y.Doc, input: NewElement): string {
  const id = input.id ?? randomId();
  const defaults = DEFAULTS[input.type];
  doc.transact(() => {
    const map = new Y.Map<unknown>();
    map.set("type", input.type);
    map.set("x", input.x);
    map.set("y", input.y);
    map.set("width", input.width ?? defaults.width);
    map.set("height", input.height ?? defaults.height);
    map.set("color", input.color ?? defaults.color);
    map.set("z", maxZ(doc) + 1);
    map.set("text", new Y.Text(input.text ?? ""));
    getElementsMap(doc).set(id, map);
  }, LOCAL_ORIGIN);
  return id;
}

export function updateElement(doc: Y.Doc, id: string, patch: ElementPatch): void {
  const map = getElementsMap(doc).get(id);
  if (!map) return; // may have been deleted by someone else meanwhile
  doc.transact(() => {
    for (const [key, value] of Object.entries(patch)) {
      // Skip no-op writes: they would still create CRDT history and network traffic.
      if (value !== undefined && map.get(key) !== value) map.set(key, value);
    }
  }, LOCAL_ORIGIN);
}

export function moveElements(doc: Y.Doc, ids: string[], dx: number, dy: number): void {
  const elements = getElementsMap(doc);
  doc.transact(() => {
    for (const id of ids) {
      const map = elements.get(id);
      if (!map) continue;
      map.set("x", (map.get("x") as number) + dx);
      map.set("y", (map.get("y") as number) + dy);
    }
  }, LOCAL_ORIGIN);
}

export function deleteElements(doc: Y.Doc, ids: string[]): void {
  const elements = getElementsMap(doc);
  doc.transact(() => {
    for (const id of ids) elements.delete(id);
  }, LOCAL_ORIGIN);
}

export function bringToFront(doc: Y.Doc, id: string): void {
  const map = getElementsMap(doc).get(id);
  if (!map) return;
  const top = maxZ(doc);
  if ((map.get("z") as number) === top) return;
  doc.transact(() => map.set("z", top + 1), LOCAL_ORIGIN);
}

/**
 * Replace the text of an element with `next`.
 *
 * Instead of clearing the Y.Text and inserting the whole string (which would
 * wipe out what a collaborator typed at the same time), we only apply the
 * minimal change: keep the common prefix and suffix, then delete/insert the
 * middle part. This is what keeps concurrent edits mergeable.
 */
export function setText(doc: Y.Doc, id: string, next: string): void {
  const text = getElementsMap(doc).get(id)?.get("text");
  if (!(text instanceof Y.Text)) return;
  const current = text.toString();
  if (current === next) return;

  let start = 0;
  while (start < current.length && start < next.length && current[start] === next[start]) start++;

  let endCurrent = current.length;
  let endNext = next.length;
  while (endCurrent > start && endNext > start && current[endCurrent - 1] === next[endNext - 1]) {
    endCurrent--;
    endNext--;
  }

  doc.transact(() => {
    if (endCurrent > start) text.delete(start, endCurrent - start);
    if (endNext > start) text.insert(start, next.slice(start, endNext));
  }, LOCAL_ORIGIN);
}
