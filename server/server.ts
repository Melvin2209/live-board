import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { BoardPersistence } from "./persistence";
import { Room } from "./room";

export interface ServerOptions {
  port: number;
  dbPath: string;
  saveDebounceMs?: number;
}

export interface RunningServer {
  port: number;
  close: () => Promise<void>;
}

/** Board ids come from the URL: keep them short and URL-safe. */
export const BOARD_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

const HEARTBEAT_MS = 30_000;

export function startServer({ port, dbPath, saveDebounceMs = 1000 }: ServerOptions): Promise<RunningServer> {
  const persistence = new BoardPersistence(dbPath);
  const rooms = new Map<string, Room>();

  const httpServer = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ noServer: true });

  // The y-websocket client connects to ws://host/<boardId>.
  httpServer.on("upgrade", (req, socket, head) => {
    const boardId = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname.slice(1));
    if (!BOARD_ID_PATTERN.test(boardId)) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, boardId));
  });

  function onConnection(ws: WebSocket, boardId: string) {
    let room = rooms.get(boardId);
    if (!room) {
      room = new Room(boardId, persistence, saveDebounceMs);
      rooms.set(boardId, room);
    }
    const joined = room;
    ws.binaryType = "arraybuffer";

    // Detect dead connections (closed laptop, lost network) with ping/pong.
    let alive = true;
    ws.on("pong", () => (alive = true));
    const heartbeat = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, HEARTBEAT_MS);

    ws.on("message", (data: ArrayBuffer) => {
      try {
        joined.handleMessage(ws, new Uint8Array(data));
      } catch (err) {
        console.error(`[${boardId}] invalid message`, err);
        ws.close(1003);
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      joined.leave(ws);
      // Free memory when the board is empty; its state is saved first.
      if (joined.size === 0) {
        joined.destroy();
        rooms.delete(boardId);
      }
    });

    joined.join(ws);
  }

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      resolve({
        port: (httpServer.address() as AddressInfo).port,
        close: async () => {
          for (const ws of wss.clients) ws.terminate();
          for (const room of rooms.values()) room.destroy();
          rooms.clear();
          await new Promise<void>((done) => wss.close(() => done()));
          await new Promise<void>((done) => httpServer.close(() => done()));
          persistence.close();
        },
      });
    });
  });
}
