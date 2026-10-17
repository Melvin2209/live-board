import { NewBoardButton } from "./NewBoardButton";

export default function Home() {
  return (
    <main className="home">
      <h1>
        live<span>-board</span>
      </h1>
      <p className="tagline">A real-time collaborative whiteboard. Sticky notes, shapes and text, shared with a link.</p>
      <NewBoardButton />
      <ul className="features">
        <li>Live cursors and presence</li>
        <li>Conflict-free edits (CRDT)</li>
        <li>Works offline, syncs back</li>
        <li>Per-user undo / redo</li>
      </ul>
    </main>
  );
}
