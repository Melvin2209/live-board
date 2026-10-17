"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import * as Y from "yjs";

// Konva needs `window`: render the canvas on the client only.
const BoardCanvas = dynamic(() => import("@/components/BoardCanvas").then((m) => m.BoardCanvas), { ssr: false });

export function BoardClient({ boardId }: { boardId: string }) {
  const [doc] = useState(() => new Y.Doc());
  return (
    <main data-board-id={boardId}>
      <BoardCanvas doc={doc} />
    </main>
  );
}
