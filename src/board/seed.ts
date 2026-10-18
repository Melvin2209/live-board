import * as Y from "yjs";
import { createElement, type ElementType } from "./model";

const TYPES: ElementType[] = ["sticky", "rect", "ellipse", "text"];
const COLORS = ["#fde68a", "#fca5a5", "#93c5fd", "#86efac", "#c4b5fd"];

export const SEED_SPACING = 170;
export const SEED_SIZE = 150;

/**
 * Fill a board with `count` elements laid out on a grid centered on `center`.
 * Used by the performance benchmark. All in one transaction = one update.
 */
export function seedBoard(doc: Y.Doc, count: number, center = { x: 0, y: 0 }): void {
  const cols = Math.ceil(Math.sqrt(count * 1.25));
  const rows = Math.ceil(count / cols);
  const originX = center.x - (cols * SEED_SPACING) / 2;
  const originY = center.y - (rows * SEED_SPACING) / 2;
  doc.transact(() => {
    for (let i = 0; i < count; i++) {
      const type = TYPES[i % TYPES.length];
      createElement(doc, {
        id: `seed-${i}`,
        type,
        x: originX + (i % cols) * SEED_SPACING,
        y: originY + Math.floor(i / cols) * SEED_SPACING,
        width: SEED_SIZE,
        height: type === "text" ? 40 : SEED_SIZE,
        color: type === "text" ? "#1f2328" : COLORS[i % COLORS.length],
        text: `Item ${i + 1}`,
      });
    }
  });
}
