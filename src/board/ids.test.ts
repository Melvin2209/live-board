import { describe, expect, it } from "vitest";
import { isValidBoardId, randomId } from "./ids";

describe("randomId", () => {
  it("returns url-safe ids of the requested length", () => {
    const id = randomId(12);
    expect(id).toMatch(/^[0-9a-z]{12}$/);
  });

  it("generates valid board ids", () => {
    expect(isValidBoardId(randomId())).toBe(true);
  });

  it("does not collide on a small sample", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => randomId()));
    expect(ids.size).toBe(1000);
  });
});

describe("isValidBoardId", () => {
  it("accepts short url-safe ids only", () => {
    expect(isValidBoardId("team-retro-42")).toBe(true);
    expect(isValidBoardId("")).toBe(false);
    expect(isValidBoardId("Upper")).toBe(false);
    expect(isValidBoardId("../etc/passwd")).toBe(false);
    expect(isValidBoardId("a".repeat(65))).toBe(false);
  });
});
