"use client";

import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import { setText, type BoardElement } from "@/board/model";
import { worldToScreen, type Viewport } from "@/board/viewport";

interface Props {
  doc: Y.Doc;
  element: BoardElement;
  viewport: Viewport;
  onClose: () => void;
}

/**
 * HTML textarea laid exactly over the canvas element while editing.
 * Every keystroke is written to the Y.Text, so collaborators see the text live.
 */
export function TextEditor({ doc, element, viewport, onClose }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  const topLeft = worldToScreen(viewport, element);
  const isText = element.type === "text";
  const centered = element.type === "rect" || element.type === "ellipse";

  return (
    <textarea
      ref={ref}
      className="text-editor"
      data-testid="text-editor"
      value={element.text}
      placeholder={isText ? "Text" : ""}
      onChange={(e) => setText(doc, element.id, e.target.value)}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) onClose();
      }}
      style={{
        left: topLeft.x,
        top: topLeft.y,
        width: element.width * viewport.scale,
        height: element.height * viewport.scale,
        fontSize: (isText ? 20 : 16) * viewport.scale,
        padding: isText ? 0 : 12 * viewport.scale,
        textAlign: centered ? "center" : "left",
        color: isText ? element.color : "#1f2328",
      }}
    />
  );
}
