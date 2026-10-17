"use client";

import { useRouter } from "next/navigation";
import { randomId } from "@/board/ids";

export function NewBoardButton() {
  const router = useRouter();
  return (
    <button type="button" className="cta" data-testid="new-board" onClick={() => router.push(`/b/${randomId()}`)}>
      Create a new board
    </button>
  );
}
