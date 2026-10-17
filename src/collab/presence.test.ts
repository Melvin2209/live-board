import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { remoteUsers, throttle, type PresenceState } from "./presence";
import { loadUser, randomUser, USER_COLORS } from "./user";

describe("remoteUsers", () => {
  it("excludes the local client and clients without identity", () => {
    const states = new Map<number, PresenceState>([
      [1, { user: { name: "Me", color: "#000" }, cursor: { x: 1, y: 1 } }],
      [3, { user: { name: "Bob", color: "#f00" }, cursor: { x: 5, y: 6 }, selection: ["a"] }],
      [2, { user: { name: "Alice", color: "#0f0" } }],
      [4, {}], // connected but not initialised yet
    ]);
    expect(remoteUsers(states, 1)).toEqual([
      { clientId: 2, user: { name: "Alice", color: "#0f0" }, cursor: null, selection: [] },
      { clientId: 3, user: { name: "Bob", color: "#f00" }, cursor: { x: 5, y: 6 }, selection: ["a"] },
    ]);
  });
});

describe("throttle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls immediately, then at most once per interval with the latest value", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(fn.mock.calls).toEqual([[1]]);
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1], [3]]);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("user identity", () => {
  it("creates a random identity with a palette color", () => {
    const user = randomUser(() => 0);
    expect(user).toEqual({ name: "Curious Otter", color: USER_COLORS[0] });
  });

  it("persists the identity in storage", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    const first = loadUser(storage);
    expect(loadUser(storage)).toEqual(first);
  });

  it("recovers from a corrupted value", () => {
    const storage = { getItem: () => "{not json", setItem: () => {} };
    expect(loadUser(storage).name).toMatch(/^\w+ \w+$/);
  });
});
