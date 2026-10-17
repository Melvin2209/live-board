import { notFound } from "next/navigation";
import { isValidBoardId } from "@/board/ids";
import { BoardClient } from "./BoardClient";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  if (!isValidBoardId(boardId)) notFound();
  return <BoardClient boardId={boardId} />;
}
