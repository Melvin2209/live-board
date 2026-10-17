"use client";

import { useEffect, useState } from "react";
import type { Awareness } from "y-protocols/awareness";
import { remoteUsers, type PresenceState, type RemoteUser } from "./presence";

/** Live list of the other users on the board (name, color, cursor, selection). */
export function useRemoteUsers(awareness: Awareness | undefined): RemoteUser[] {
  const [users, setUsers] = useState<RemoteUser[]>([]);

  useEffect(() => {
    if (!awareness) return;
    const update = () =>
      setUsers(remoteUsers(awareness.getStates() as Map<number, PresenceState>, awareness.clientID));
    const onChange = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      // Our own cursor moves constantly: don't re-render for local-only changes.
      const changed = [...added, ...updated, ...removed];
      if (changed.some((id) => id !== awareness.clientID)) update();
    };
    update();
    awareness.on("change", onChange);
    return () => awareness.off("change", onChange);
  }, [awareness]);

  return users;
}
