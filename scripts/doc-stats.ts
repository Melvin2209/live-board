/**
 * Size of the CRDT data for a seeded board: what the server stores and what
 * travels on the network. Run with `npm run bench:doc`.
 */
import * as Y from "yjs";
import { moveElements, setText } from "../src/board/model";
import { seedBoard } from "../src/board/seed";

const count = Number(process.argv[2] ?? 500);
const doc = new Y.Doc();
seedBoard(doc, count);

const updates: Uint8Array[] = [];
doc.on("update", (u: Uint8Array) => updates.push(u));

const start = performance.now();
const snapshot = Y.encodeStateAsUpdate(doc);
const encodeMs = performance.now() - start;

moveElements(doc, ["seed-0"], 5, 5);
const moveBytes = updates.at(-1)!.byteLength;
setText(doc, "seed-0", "Item 1!");
const typeBytes = updates.at(-1)!.byteLength;

const t0 = performance.now();
Y.applyUpdate(new Y.Doc(), snapshot);
const loadMs = performance.now() - t0;

console.table({
  elements: count,
  "snapshot size (KB)": +(snapshot.byteLength / 1024).toFixed(1),
  "encode snapshot (ms)": +encodeMs.toFixed(1),
  "load snapshot (ms)": +loadMs.toFixed(1),
  "one move update (bytes)": moveBytes,
  "one keystroke update (bytes)": typeBytes,
});
