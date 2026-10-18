"use client";

import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";

export type ConnectionStatus = "online" | "connecting" | "offline";

export function connectionStatus(wsStatus: string, browserOnline: boolean): ConnectionStatus {
  if (wsStatus === "connected") return "online";
  return browserOnline ? "connecting" : "offline";
}

export function useConnectionStatus(provider: WebsocketProvider | undefined): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (!provider) return;
    const update = () => setStatus(connectionStatus(provider.wsconnected ? "connected" : "disconnected", navigator.onLine));
    update();
    provider.on("status", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      provider.off("status", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [provider]);

  return status;
}
