import * as Y from "yjs";
import { getElementsMap, LOCAL_ORIGIN } from "./model";

/**
 * Undo/redo for the local user only.
 *
 * `trackedOrigins` limits the history to transactions tagged with
 * LOCAL_ORIGIN, so changes received from collaborators are never undone by
 * us. Undo itself is a regular CRDT change: it is synced like any other edit.
 *
 * Changes made within `captureTimeout` ms are grouped into a single step
 * (e.g. all the positions of a drag, or a burst of typing).
 */
export function createUndoManager(doc: Y.Doc, captureTimeout = 400): Y.UndoManager {
  return new Y.UndoManager(getElementsMap(doc), {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout,
  });
}
