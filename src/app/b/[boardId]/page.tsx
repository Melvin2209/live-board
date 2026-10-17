import { BoardClient } from "./BoardClient";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <BoardClient boardId={boardId} />;
}
