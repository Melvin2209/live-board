import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { listElements } from "./model";
import { seedBoard, SEED_SIZE } from "./seed";

describe("seedBoard", () => {
  it("creates non-overlapping elements centered on the given point", () => {
    const doc = new Y.Doc();
    seedBoard(doc, 500, { x: 640, y: 400 });
    const elements = listElements(doc);
    expect(elements).toHaveLength(500);

    const positions = new Set(elements.map((e) => `${e.x},${e.y}`));
    expect(positions.size).toBe(500);

    const minX = Math.min(...elements.map((e) => e.x));
    const maxX = Math.max(...elements.map((e) => e.x + SEED_SIZE));
    expect(Math.abs((minX + maxX) / 2 - 640)).toBeLessThan(200);
  });
});
