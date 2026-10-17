"use client";

import { useEffect, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export interface BoardSession {
  doc: Y.Doc;
  provider: WebsocketProvider;
}

/** Where the sync server lives. Defaults to port 1234 on the same host as the page. */
export function syncServerUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:1234`;
}

/**
 * Creates the Y.Doc of a board and connects it to the sync server.
 * Created in an effect (not during render) so React StrictMode's
 * mount/unmount/mount cycle cannot leak a second WebSocket.
 */
export function useBoardSession(boardId: string): BoardSession | null {
  const [session, setSession] = useState<BoardSession | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    // The provider reconnects by itself (with exponential backoff) when the
    // connection drops, then re-syncs the missing updates in both directions.
    const provider = new WebsocketProvider(syncServerUrl(), boardId, doc);
    // Exposing an external resource created by the effect is intended here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ doc, provider });
    return () => {
      provider.destroy();
      doc.destroy();
      setSession(null);
    };
  }, [boardId]);

  return session;
}
