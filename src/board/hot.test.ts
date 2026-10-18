import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { HotElements } from "./hot";
import { createElement, moveElements } from "./model";

describe("HotElements", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const remote = new Y.Doc();
    const local = new Y.Doc();
    const id = createElement(remote, { type: "sticky", x: 0, y: 0 });
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
    const hot = new HotElements(local, 800);
    const receive = () => Y.applyUpdate(local, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(local)));
    return { remote, local, id, hot, receive };
  }

  it("marks elements changed by others as hot, then cools them down", () => {
    const { remote, id, hot, receive } = setup();
    moveElements(remote, [id], 10, 0);
    receive();
    expect([...hot.getSnapshot()]).toEqual([id]);

    vi.advanceTimersByTime(400);
    moveElements(remote, [id], 10, 0); // still being dragged
    receive();
    vi.advanceTimersByTime(500);
    expect(hot.getSnapshot().has(id)).toBe(true);

    vi.advanceTimersByTime(1000); // no more updates
    expect(hot.getSnapshot().size).toBe(0);
  });

  it("ignores local changes and remote creations", () => {
    const { remote, local, id, hot, receive } = setup();
    moveElements(local, [id], 5, 5);
    createElement(remote, { type: "rect", x: 0, y: 0 });
    receive();
    expect(hot.getSnapshot().size).toBe(0);
  });
});
