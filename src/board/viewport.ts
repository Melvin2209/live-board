/**
 * Viewport math. The stage is translated by (x, y) and scaled by `scale`:
 *   screen = world * scale + offset
 *   world  = (screen - offset) / scale
 */
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_SCALE = 0.1;
/**
 * Level of detail: below this zoom, text would be a few pixels tall and
 * unreadable, so we skip drawing it (the most expensive part of a frame).
 */
export const TEXT_MIN_SCALE = 0.4;
export const MAX_SCALE = 4;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function screenToWorld(vp: Viewport, p: Point): Point {
  return { x: (p.x - vp.x) / vp.scale, y: (p.y - vp.y) / vp.scale };
}

export function worldToScreen(vp: Viewport, p: Point): Point {
  return { x: p.x * vp.scale + vp.x, y: p.y * vp.scale + vp.y };
}

/** Zoom by `factor` while keeping the world point under `screenPoint` fixed (zoom to cursor). */
export function zoomAt(vp: Viewport, screenPoint: Point, factor: number): Viewport {
  const scale = clampScale(vp.scale * factor);
  const world = screenToWorld(vp, screenPoint);
  return { scale, x: screenPoint.x - world.x * scale, y: screenPoint.y - world.y * scale };
}
