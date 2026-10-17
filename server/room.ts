import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import type { WebSocket } from "ws";
import * as Y from "yjs";
import type { BoardPersistence } from "./persistence";

// Message types of the y-websocket protocol (what the client provider speaks).
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

/**
 * One shared board: a server-side Y.Doc, the awareness (who is here, cursors)
 * and the WebSocket connections of the people currently on it.
 *
 * The server is a regular Yjs peer. It merges what clients send, so a client
 * that reconnects after working offline just exchanges the missing updates
 * (sync step 1 / step 2) and the CRDT does the conflict resolution.
 */
export class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  /** Each connection with the awareness client ids it announced. */
  private readonly conns = new Map<WebSocket, Set<number>>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly id: string,
    private readonly persistence: BoardPersistence,
    private readonly saveDebounceMs: number,
  ) {
    const saved = persistence.load(id);
    if (saved) Y.applyUpdate(this.doc, saved);

    // The server has no user of its own: it must not appear as a collaborator.
    this.awareness.setLocalState(null);

    this.doc.on("update", (update: Uint8Array) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder));
      this.scheduleSave();
    });

    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        // Remember which awareness ids belong to which socket, to clean them up on disconnect.
        const conn = origin as WebSocket | null;
        const ids = conn ? this.conns.get(conn) : undefined;
        if (ids) {
          added.forEach((id) => ids.add(id));
          removed.forEach((id) => ids.delete(id));
        }
        const changed = [...added, ...updated, ...removed];
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
        this.broadcast(encoding.toUint8Array(encoder));
      },
    );
  }

  get size(): number {
    return this.conns.size;
  }

  join(conn: WebSocket): void {
    this.conns.set(conn, new Set());

    // Start the sync handshake: send our state vector, the client answers
    // with what we are missing (and asks for what it is missing).
    const sync = encoding.createEncoder();
    encoding.writeVarUint(sync, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(sync, this.doc);
    this.send(conn, encoding.toUint8Array(sync));

    const states = this.awareness.getStates();
    if (states.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...states.keys()]));
      this.send(conn, encoding.toUint8Array(encoder));
    }
  }

  handleMessage(conn: WebSocket, data: Uint8Array): void {
    const decoder = decoding.createDecoder(data);
    const encoder = encoding.createEncoder();
    const type = decoding.readVarUint(decoder);

    if (type === MESSAGE_SYNC) {
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      // Applies the client's updates to our doc (origin = conn) and/or writes a reply.
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, conn);
      // Only the message type was written => nothing to answer.
      if (encoding.length(encoder) > 1) this.send(conn, encoding.toUint8Array(encoder));
    } else if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), conn);
    } else if (type === MESSAGE_QUERY_AWARENESS) {
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...this.awareness.getStates().keys()]),
      );
      this.send(conn, encoding.toUint8Array(encoder));
    }
  }

  leave(conn: WebSocket): void {
    const ids = this.conns.get(conn);
    this.conns.delete(conn);
    // Remove the cursors of this connection right away instead of waiting
    // for the awareness timeout (30 s).
    if (ids?.size) awarenessProtocol.removeAwarenessStates(this.awareness, [...ids], null);
  }

  /** Save right away (used when the last user leaves and on shutdown). */
  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.persistence.save(this.id, Y.encodeStateAsUpdate(this.doc));
  }

  destroy(): void {
    this.flush();
    this.awareness.destroy();
    this.doc.destroy();
  }

  /** Batch writes: a drag produces dozens of updates per second, one save is enough. */
  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.flush(), this.saveDebounceMs);
  }

  private broadcast(message: Uint8Array) {
    for (const conn of this.conns.keys()) this.send(conn, message);
  }

  private send(conn: WebSocket, message: Uint8Array) {
    if (conn.readyState !== conn.OPEN) return this.leave(conn);
    conn.send(message, (err) => err && this.leave(conn));
  }
}
