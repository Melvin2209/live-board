import { startServer } from "./server";

const port = Number(process.env.PORT ?? 1234);
const dbPath = process.env.DB_PATH ?? "data/live-board.sqlite";
const saveDebounceMs = Number(process.env.SAVE_DEBOUNCE_MS ?? 1000);

const server = await startServer({ port, dbPath, saveDebounceMs });
console.log(`live-board sync server on ws://localhost:${server.port} (db: ${dbPath})`);

// Save every open board before exiting.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
