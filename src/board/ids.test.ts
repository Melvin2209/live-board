import { describe, expect, it } from "vitest";
import { randomId } from "./ids";

describe("randomId", () => {
  it("returns url-safe ids of the requested length", () => {
    const id = randomId(12);
    expect(id).toMatch(/^[0-9a-z]{12}$/);
  });

  it("does not collide on a small sample", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => randomId()));
    expect(ids.size).toBe(1000);
  });
});
