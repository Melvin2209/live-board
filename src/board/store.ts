import * as Y from "yjs";
import { compareByZ, getElementsMap, readElement, type BoardElement } from "./model";

/**
 * Bridges the Yjs document to React (via useSyncExternalStore).
 *
 * Performance matters here: with 500 elements we cannot rebuild every element
 * object on each change, otherwise every shape re-renders while one is dragged.
 * So the store keeps one immutable snapshot per element and, on each Yjs
 * transaction, only rebuilds the elements that were actually touched.
 * Untouched elements keep the same object reference, which lets
 * `React.memo` skip them.
 */
export class BoardStore {
  private byId = new Map<string, BoardElement>();
  private sorted: BoardElement[] = [];
  private listeners = new Set<() => void>();
  private readonly elements: Y.Map<Y.Map<unknown>>;

  constructor(doc: Y.Doc) {
    this.elements = getElementsMap(doc);
    this.elements.forEach((map, id) => this.byId.set(id, readElement(id, map)));
    this.resort();
    this.elements.observeDeep(this.onChange);
  }

  private onChange = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
    const touched = new Set<string>();
    for (const event of events) {
      if (event.target === this.elements) {
        // Elements added or removed at the top level.
        event.changes.keys.forEach((_change, id) => touched.add(id));
      } else {
        // A nested change: path[0] is the id of the element that owns it
        // (path is [id] for a property change, [id, "text"] for text edits).
        touched.add(event.path[0] as string);
      }
    }
    for (const id of touched) {
      const map = this.elements.get(id);
      if (map) this.byId.set(id, readElement(id, map));
      else this.byId.delete(id);
    }
    this.resort();
    this.listeners.forEach((listener) => listener());
  };

  private resort() {
    this.sorted = [...this.byId.values()].sort(compareByZ);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): BoardElement[] => this.sorted;

  get(id: string): BoardElement | undefined {
    return this.byId.get(id);
  }

  destroy() {
    this.elements.unobserveDeep(this.onChange);
    this.listeners.clear();
  }
}
