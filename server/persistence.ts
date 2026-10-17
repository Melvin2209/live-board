import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Stores one binary Yjs snapshot per board in SQLite.
 *
 * A snapshot (`Y.encodeStateAsUpdate(doc)`) contains the whole CRDT state, so
 * loading a board is a single `Y.applyUpdate`. We overwrite it on every save
 * instead of appending each small update: simpler, and the table stays small.
 *
 * Uses Node's built-in `node:sqlite`: no native module to compile.
 */
export class BoardPersistence {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS boards (
        id         TEXT PRIMARY KEY,
        state      BLOB NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  load(boardId: string): Uint8Array | null {
    const row = this.db.prepare("SELECT state FROM boards WHERE id = ?").get(boardId) as
      | { state: Uint8Array }
      | undefined;
    return row ? new Uint8Array(row.state) : null;
  }

  save(boardId: string, state: Uint8Array): void {
    this.db
      .prepare(
        `INSERT INTO boards (id, state, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
      )
      .run(boardId, state, Date.now());
  }

  close(): void {
    this.db.close();
  }
}
