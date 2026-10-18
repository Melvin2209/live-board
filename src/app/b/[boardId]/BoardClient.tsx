"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useBoardSession } from "@/collab/useBoardSession";
import { loadUser, saveUser, type UserInfo } from "@/collab/user";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { ShareButton } from "@/components/ShareButton";
import { TopBar } from "@/components/TopBar";

// Konva needs `window`: render the canvas on the client only.
const BoardCanvas = dynamic(() => import("@/components/BoardCanvas").then((m) => m.BoardCanvas), { ssr: false });

declare global {
  interface Window {
    /** Debug handle used by the e2e tests and the benchmark script. */
    __liveBoard?: ReturnType<typeof useBoardSession>;
  }
}

export function BoardClient({ boardId }: { boardId: string }) {
  const session = useBoardSession(boardId);
  const [user, setUser] = useState<UserInfo | null>(null);

  // localStorage is only available in the browser, so load after mount
  // (reading it during render would break server rendering / hydration).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setUser(loadUser()), []);

  // Publish our identity to the other participants.
  useEffect(() => {
    if (session && user) session.provider.awareness.setLocalStateField("user", user);
  }, [session, user]);

  useEffect(() => {
    window.__liveBoard = session;
  }, [session]);

  const rename = (name: string) => {
    if (!user) return;
    const next = { ...user, name };
    setUser(next);
    saveUser(next);
  };

  return (
    <main>
      {user && (
        <TopBar boardId={boardId} user={user} onRename={rename} awareness={session?.provider.awareness}>
          <ConnectionBadge provider={session?.provider} />
          <ShareButton />
        </TopBar>
      )}
      {session && <BoardCanvas key={boardId} doc={session.doc} awareness={session.provider.awareness} />}
    </main>
  );
}
