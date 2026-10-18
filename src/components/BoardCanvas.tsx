"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Layer, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import {
  bringToFront,
  createElement,
  deleteElements,
  moveElements,
  updateElement,
  type ElementType,
} from "@/board/model";
import { createUndoManager } from "@/board/history";
import { BoardStore } from "@/board/store";
import { screenToWorld, zoomAt, type Viewport } from "@/board/viewport";
import { throttle } from "@/collab/presence";
import { ElementShape, type ElementHandlers } from "./ElementShape";
import { RemoteCursors } from "./RemoteCursors";
import { TextEditor } from "./TextEditor";
import { Toolbar, type Tool } from "./Toolbar";

interface Props {
  doc: Y.Doc;
  /** Presence channel. Optional so the canvas also works without a server. */
  awareness?: Awareness;
}

const TOOL_KEYS: Record<string, Tool> = { v: "select", s: "sticky", r: "rect", o: "ellipse", t: "text" };

function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName));
}

export function BoardCanvas({ doc, awareness }: Props) {
  // The store observes the doc for its whole lifetime; both are garbage
  // collected together, so there is nothing to tear down here.
  const store = useMemo(() => new BoardStore(doc), [doc]);
  const elements = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const undoManager = useMemo(() => createUndoManager(doc), [doc]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    const update = () => setHistory({ canUndo: undoManager.canUndo(), canRedo: undoManager.canRedo() });
    const events = ["stack-item-added", "stack-item-popped", "stack-cleared"] as const;
    events.forEach((name) => undoManager.on(name, update));
    return () => events.forEach((name) => undoManager.off(name, update));
  }, [undoManager]);

  const size = useWindowSize();
  const [tool, setTool] = useState<Tool>("select");
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [selection, setSelection] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Elements can be deleted by a collaborator: drop them from the selection.
  const liveSelection = useMemo(() => selection.filter((id) => store.get(id)), [selection, store, elements]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectionRef = useRef(liveSelection);
  useEffect(() => {
    selectionRef.current = liveSelection;
  }, [liveSelection]);

  /* ------------------------------ presence -------------------------------- */

  // Share what we have selected so others can see it.
  useEffect(() => {
    awareness?.setLocalStateField("selection", liveSelection);
  }, [awareness, liveSelection]);

  const publishCursor = useMemo(
    () => throttle((cursor: { x: number; y: number } | null) => awareness?.setLocalStateField("cursor", cursor), 33),
    [awareness],
  );

  const onPointerMove = () => {
    const p = pointerWorld();
    if (p) publishCursor(p);
  };

  /* ---------------------------- element handlers --------------------------- */

  // Pointer moves fire far more often than the screen refreshes. We keep only
  // the latest drag position and write it to Yjs once per animation frame:
  // fewer CRDT updates, fewer React renders, less network traffic.
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);
  const dragFrame = useRef<number | null>(null);

  const flushDrag = useCallback(() => {
    dragFrame.current = null;
    const pending = pendingDrag.current;
    pendingDrag.current = null;
    const current = pending && store.get(pending.id);
    if (!pending || !current) return;
    const dx = pending.x - current.x;
    const dy = pending.y - current.y;
    if (dx === 0 && dy === 0) return;
    // Dragging one selected element moves the whole selection.
    const ids = selectionRef.current.includes(pending.id) ? selectionRef.current : [pending.id];
    moveElements(doc, ids, dx, dy);
  }, [doc, store]);

  const handlers = useMemo<ElementHandlers>(
    () => ({
      onPointerDown: (id, e) => {
        e.cancelBubble = true; // don't start a stage pan
        const additive = "shiftKey" in e.evt && e.evt.shiftKey;
        setSelection((sel) => {
          if (additive) return sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id];
          return sel.includes(id) ? sel : [id];
        });
      },
      onDoubleClick: (id) => {
        setSelection([id]);
        setEditingId(id);
      },
      onDragStart: (id) => {
        // Start a fresh undo step: the whole drag will be undone at once.
        undoManager.stopCapturing();
        bringToFront(doc, id);
      },
      onDragMove: (id, x, y) => {
        pendingDrag.current = { id, x, y };
        dragFrame.current ??= requestAnimationFrame(flushDrag);
      },
      onDragEnd: (id, x, y) => {
        if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
        pendingDrag.current = { id, x, y };
        flushDrag();
      },
    }),
    [doc, flushDrag, undoManager],
  );

  /* ------------------------------ stage events ----------------------------- */

  const pointerWorld = () => {
    const pointer = stageRef.current?.getPointerPosition();
    return pointer ? screenToWorld(viewport, pointer) : null;
  };

  const createAt = (type: ElementType) => {
    const p = pointerWorld();
    if (!p) return;
    undoManager.stopCapturing(); // each discrete action is its own undo step
    const id = createElement(doc, { type, x: p.x - 80, y: p.y - (type === "text" ? 20 : 60) });
    setSelection([id]);
    setTool("select");
    if (type === "sticky" || type === "text") setEditingId(id);
  };

  const onStagePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target !== e.target.getStage()) return; // clicked an element
    if (tool !== "select") {
      // The new element may open a text editor right away: prevent the browser
      // from moving focus back to the page at the end of this mousedown.
      e.evt.preventDefault();
      createAt(tool);
    } else setSelection([]);
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Pinch-to-zoom on trackpads also arrives as ctrl+wheel.
      setViewport((vp) => zoomAt(vp, pointer, Math.exp(-e.evt.deltaY * 0.01)));
    } else {
      setViewport((vp) => ({ ...vp, x: vp.x - e.evt.deltaX, y: vp.y - e.evt.deltaY }));
    }
  };

  const onStageDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target !== stageRef.current) return; // an element is being dragged
    setViewport((vp) => ({ ...vp, x: e.target.x(), y: e.target.y() }));
  };

  const zoomBy = (factor: number) =>
    setViewport((vp) => zoomAt(vp, { x: size.width / 2, y: size.height / 2 }, factor));

  /* ------------------------------ resizing --------------------------------- */

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const nodes = editingId ? [] : liveSelection.map((id) => stage.findOne(`#${id}`)).filter((n) => n !== undefined);
    transformer.nodes(nodes);
  }, [liveSelection, editingId, elements]);

  const onTransformEnd = () => {
    undoManager.stopCapturing();
    // Konva resizes by scaling the node; we bake the scale into width/height
    // so the stored data stays simple (scale is always 1).
    for (const node of transformerRef.current?.nodes() ?? []) {
      const el = store.get(node.id());
      if (!el) continue;
      const width = Math.max(20, Math.round(el.width * node.scaleX()));
      const height = Math.max(20, Math.round(el.height * node.scaleY()));
      node.scale({ x: 1, y: 1 });
      updateElement(doc, el.id, { x: node.x(), y: node.y(), width, height });
    }
  };

  /* ------------------------------ keyboard --------------------------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // Handled even inside the text editor: the textarea's native undo would
      // not know about the shared Y.Text, so we route it to the UndoManager.
      if (mod && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) undoManager.redo();
        else undoManager.undo();
        return;
      }
      if (isTyping(e.target)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectionRef.current.length) {
        undoManager.stopCapturing();
        deleteElements(doc, selectionRef.current);
        setSelection([]);
      } else if (e.key === "Escape") {
        setSelection([]);
        setTool("select");
      } else if (!mod && !e.altKey && TOOL_KEYS[key]) {
        setTool(TOOL_KEYS[key]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doc, undoManager]);

  /* -------------------------------- render --------------------------------- */

  const editing = editingId ? store.get(editingId) : undefined;
  const selectedColor = liveSelection.length ? store.get(liveSelection[0])?.color : undefined;

  return (
    <div className="board" data-tool={tool}>
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        selectedColor={selectedColor}
        onColorChange={(color) => {
          undoManager.stopCapturing();
          liveSelection.forEach((id) => updateElement(doc, id, { color }));
        }}
        onDelete={() => {
          undoManager.stopCapturing();
          deleteElements(doc, liveSelection);
          setSelection([]);
        }}
        zoom={viewport.scale}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onZoomReset={() => setViewport({ x: 0, y: 0, scale: 1 })}
        onUndo={history.canUndo ? () => undoManager.undo() : undefined}
        onRedo={history.canRedo ? () => undoManager.redo() : undefined}
      />
      <div className="element-count" data-testid="element-count">
        {elements.length} {elements.length === 1 ? "element" : "elements"}
      </div>
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={tool === "select"}
          onMouseDown={onStagePointerDown}
          onTouchStart={onStagePointerDown}
          onWheel={onWheel}
          onMouseMove={onPointerMove}
          onTouchMove={onPointerMove}
          onMouseLeave={() => publishCursor(null)}
          onDragMove={onStageDrag}
          onDragEnd={onStageDrag}
        >
          <Layer>
            {elements.map((el) => (
              <ElementShape
                key={el.id}
                element={el}
                draggable={tool === "select" && editingId !== el.id}
                hideText={editingId === el.id}
                handlers={handlers}
              />
            ))}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              keepRatio={false}
              ignoreStroke
              onTransformEnd={onTransformEnd}
            />
          </Layer>
          {awareness && <RemoteCursors awareness={awareness} store={store} scale={viewport.scale} />}
        </Stage>
      )}
      {editing && (
        <TextEditor doc={doc} element={editing} viewport={viewport} onClose={() => setEditingId(null)} />
      )}
    </div>
  );
}
