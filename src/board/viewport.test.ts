import { describe, expect, it } from "vitest";
import { MAX_SCALE, MIN_SCALE, screenToWorld, worldToScreen, zoomAt } from "./viewport";

describe("viewport", () => {
  const vp = { x: 100, y: 50, scale: 2 };

  it("converts between screen and world coordinates", () => {
    const world = screenToWorld(vp, { x: 300, y: 250 });
    expect(world).toEqual({ x: 100, y: 100 });
    expect(worldToScreen(vp, world)).toEqual({ x: 300, y: 250 });
  });

  it("keeps the point under the cursor fixed when zooming", () => {
    const cursor = { x: 400, y: 300 };
    const before = screenToWorld(vp, cursor);
    const zoomed = zoomAt(vp, cursor, 1.5);
    expect(zoomed.scale).toBe(3);
    const after = screenToWorld(zoomed, cursor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("clamps the zoom level", () => {
    expect(zoomAt(vp, { x: 0, y: 0 }, 100).scale).toBe(MAX_SCALE);
    expect(zoomAt(vp, { x: 0, y: 0 }, 0.001).scale).toBe(MIN_SCALE);
  });
});
