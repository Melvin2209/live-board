"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import * as Y from "yjs";
import { getElementsMap, setText, type BoardElement } from "@/board/model";
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
 *
 * Caret handling: when a collaborator's text arrives, React replaces the
 * textarea value and the browser moves our caret to the end. Typing would
 * then interleave with theirs ("hbiurdignegt"). So we remember the caret as a
 * Yjs *relative position* (anchored to the character before it, not to an
 * index) and put it back after every remote change.
 */
export function TextEditor({ doc, element, viewport, onClose }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<{ start: Y.RelativePosition; end: Y.RelativePosition } | null>(null);

  const yText = () => {
    const text = getElementsMap(doc).get(element.id)?.get("text");
    return text instanceof Y.Text ? text : null;
  };

  /** Store the current caret relative to the characters around it. */
  const rememberCaret = () => {
    const textarea = ref.current;
    const text = yText();
    if (!textarea || !text) return;
    // assoc = -1: stick to the character on the left, so text inserted by
    // someone else exactly at our caret goes after it, not before.
    caret.current = {
      start: Y.createRelativePositionFromTypeIndex(text, textarea.selectionStart, -1),
      end: Y.createRelativePositionFromTypeIndex(text, textarea.selectionEnd, -1),
    };
  };

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    rememberCaret();
    // Run once on open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After each text change (local or remote), restore the caret before paint.
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea || !caret.current || document.activeElement !== textarea) return;
    const start = Y.createAbsolutePositionFromRelativePosition(caret.current.start, doc)?.index;
    const end = Y.createAbsolutePositionFromRelativePosition(caret.current.end, doc)?.index;
    if (start !== undefined && end !== undefined) textarea.setSelectionRange(start, end);
  }, [doc, element.text]);

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
      onChange={(e) => {
        setText(doc, element.id, e.target.value);
        rememberCaret();
      }}
      onSelect={rememberCaret}
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
