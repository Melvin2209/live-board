import { memo } from "react";
import { Ellipse, Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { BoardElement } from "@/board/model";

export interface ElementHandlers {
  onPointerDown: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDoubleClick: (id: string) => void;
  onDragStart: (id: string, node: Konva.Node) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number, node: Konva.Node) => void;
}

interface Props {
  element: BoardElement;
  draggable: boolean;
  /** False while the HTML editor is open on top of it, or when zoomed out (level of detail). */
  showText: boolean;
  handlers: ElementHandlers;
}

const PADDING = 12;

// Texts get `listening={false}`: Konva then skips them when drawing its hit
// canvas (used to know what is under the pointer); the shape behind them
// already catches the clicks.

/**
 * One board element. Wrapped in `memo`: thanks to BoardStore, an element whose
 * data did not change keeps the same object reference, so it is not re-rendered
 * when another element moves. This is the main reason 500 elements stay smooth.
 */
export const ElementShape = memo(function ElementShape({ element: el, draggable, showText, handlers }: Props) {
  const text = showText ? el.text : "";
  return (
    <Group
      id={el.id}
      name="element"
      x={el.x}
      y={el.y}
      draggable={draggable}
      onMouseDown={(e) => handlers.onPointerDown(el.id, e)}
      onTouchStart={(e) => handlers.onPointerDown(el.id, e)}
      onDblClick={() => handlers.onDoubleClick(el.id)}
      onDblTap={() => handlers.onDoubleClick(el.id)}
      onDragStart={(e) => handlers.onDragStart(el.id, e.target)}
      onDragMove={(e) => handlers.onDragMove(el.id, e.target.x(), e.target.y())}
      onDragEnd={(e) => handlers.onDragEnd(el.id, e.target.x(), e.target.y(), e.target)}
    >
      {el.type === "sticky" && (
        <>
          <Rect width={el.width} height={el.height} fill={el.color} cornerRadius={4} stroke="#00000014" perfectDrawEnabled={false} />
          <Text listening={false} text={text} width={el.width} height={el.height} padding={PADDING} fontSize={16} lineHeight={1.3} fill="#1f2328" wrap="word" ellipsis perfectDrawEnabled={false} />
        </>
      )}
      {el.type === "rect" && (
        <>
          <Rect width={el.width} height={el.height} fill={el.color} stroke="#1f232833" cornerRadius={2} perfectDrawEnabled={false} />
          <Text listening={false} text={text} width={el.width} height={el.height} padding={PADDING} fontSize={16} align="center" verticalAlign="middle" wrap="word" ellipsis perfectDrawEnabled={false} />
        </>
      )}
      {el.type === "ellipse" && (
        <>
          <Ellipse x={el.width / 2} y={el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} fill={el.color} stroke="#1f232833" perfectDrawEnabled={false} />
          <Text listening={false} text={text} width={el.width} height={el.height} padding={PADDING * 2} fontSize={16} align="center" verticalAlign="middle" wrap="word" ellipsis perfectDrawEnabled={false} />
        </>
      )}
      {el.type === "text" && (
        <>
          {/* Invisible hit area so empty or short text is still easy to grab. */}
          <Rect width={el.width} height={el.height} fill="transparent" />
          <Text listening={false} text={text || (showText ? "Text" : "")} width={el.width} fontSize={20} fill={el.text ? el.color : "#9aa0a6"} wrap="word" perfectDrawEnabled={false} />
        </>
      )}
    </Group>
  );
});
