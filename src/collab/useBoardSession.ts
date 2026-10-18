"use client";

import { useEffect, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export interface BoardSession {
  doc: Y.Doc;
  provider: WebsocketProvider;
  local: IndexeddbPersistence;
}

/** Where the sync server lives. Defaults to port 1234 on the same host as the page. */
export function syncServerUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:1234`;
}

/**
 * Creates the Y.Doc of a board and wires its two persistence layers:
 *
 * - IndexedDB (y-indexeddb): every change is stored locally, so the board
 *   loads and stays editable without network, even after a page reload.
 * - WebSocket (y-websocket): real-time sync with the server and other users.
 *
 * Offline edits need no special code path: when the socket reconnects, the
 * Yjs sync handshake exchanges whatever each side is missing, and the CRDT
 * merges concurrent edits deterministically.
 *
 * Created in an effect (not during render) so React StrictMode's
 * mount/unmount/mount cycle cannot leak a second WebSocket.
 */
export function useBoardSession(boardId: string): BoardSession | null {
  const [session, setSession] = useState<BoardSession | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const local = new IndexeddbPersistence(`live-board:${boardId}`, doc);
    // The provider also reconnects by itself (with exponential backoff).
    const provider = new WebsocketProvider(syncServerUrl(), boardId, doc);

    // A dead connection is only noticed after a timeout; the browser knows
    // sooner, so follow its online/offline events.
    const goOffline = () => provider.disconnect();
    const goOnline = () => provider.connect();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Exposing an external resource created by the effect is intended here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ doc, provider, local });
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      provider.destroy();
      local.destroy();
      doc.destroy();
      setSession(null);
    };
  }, [boardId]);

  return session;
}
