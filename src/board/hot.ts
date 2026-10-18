import * as Y from "yjs";
import { getElementsMap } from "./model";

/**
 * Tracks the elements that *other people* are changing right now
 * (e.g. someone is dragging a sticky note).
 *
 * The canvas renders these "hot" elements on a separate small layer. Each
 * remote update then redraws a handful of shapes instead of the whole board.
 * An element cools down (goes back to the main layer) once it has not been
 * touched for `coolDownMs`.
 */
export class HotElements {
  private lastChange = new Map<string, number>();
  private snapshot: ReadonlySet<string> = new Set();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    doc: Y.Doc,
    private readonly coolDownMs = 800,
  ) {
    getElementsMap(doc).observeDeep(this.onChange);
  }

  private onChange = (events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => {
    // `local` is false only for updates received from the network.
    if (transaction.local) return;
    let added = false;
    for (const event of events) {
      // Ignore creations/deletions (path is empty for the top-level map).
      if (event.path.length === 0) continue;
      const id = event.path[0] as string;
      this.lastChange.set(id, Date.now());
      if (!this.snapshot.has(id)) added = true;
    }
    if (added) this.publish();
    this.scheduleCoolDown();
  };

  private scheduleCoolDown() {
    if (this.timer || this.lastChange.size === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const now = Date.now();
      let removed = false;
      for (const [id, at] of this.lastChange) {
        if (now - at >= this.coolDownMs) {
          this.lastChange.delete(id);
          removed = true;
        }
      }
      if (removed) this.publish();
      this.scheduleCoolDown();
    }, this.coolDownMs);
  }

  private publish() {
    this.snapshot = new Set(this.lastChange.keys());
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ReadonlySet<string> => this.snapshot;
}
