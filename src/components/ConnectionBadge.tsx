"use client";

import type { WebsocketProvider } from "y-websocket";
import { useConnectionStatus } from "@/collab/useConnectionStatus";

const LABELS = {
  online: "Online",
  connecting: "Reconnecting… edits are saved locally",
  offline: "Offline: edits are saved locally",
};

export function ConnectionBadge({ provider }: { provider?: WebsocketProvider }) {
  const status = useConnectionStatus(provider);
  return (
    <span className="connection" data-testid="connection-status" data-status={status} title={LABELS[status]}>
      <span className="dot" />
      <span className="label">{status === "online" ? "Online" : status === "offline" ? "Offline" : "Reconnecting"}</span>
    </span>
  );
}
