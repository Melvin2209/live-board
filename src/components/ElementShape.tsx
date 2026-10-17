import { memo } from "react";
import { Ellipse, Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { BoardElement } from "@/board/model";

export interface ElementHandlers {
  onPointerDown: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDoubleClick: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

interface Props {
  element: BoardElement;
  draggable: boolean;
  /** Hide the canvas text while the HTML editor is open on top of it. */
  hideText: boolean;
  handlers: ElementHandlers;
}

const PADDING = 12;

/**
 * One board element. Wrapped in `memo`: thanks to BoardStore, an element whose
 * data did not change keeps the same object reference, so it is not re-rendered
 * when another element moves. This is the main reason 500 elements stay smooth.
 */
export const ElementShape = memo(function ElementShape({ element: el, draggable, hideText, handlers }: Props) {
  const text = hideText ? "" : el.text;
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
      onDragStart={() => handlers.onDragStart(el.id)}
      onDragMove={(e) => handlers.onDragMove(el.id, e.target.x(), e.target.y())}
      onDragEnd={(e) => handlers.onDragEnd(el.id, e.target.x(), e.target.y())}
    >
      {el.type === "sticky" && (
        <>
          <Rect width={el.width} height={el.height} fill={el.color} cornerRadius={4} stroke="#00000014" perfectDrawEnabled={false} />
          <Text text={text} width={el.width} height={el.height} padding={PADDING} fontSize={16} lineHeight={1.3} fill="#1f2328" wrap="word" ellipsis perfectDrawEnabled={false} />
        </>
      )}
      {el.type === "rect" && (
        <>
          <Rect width={el.width} height={el.height} fill={el.color} stroke="#1f232833" cornerRadius={2} perfectDrawEnabled={false} />
          <Text text={text} width={el.width} height={el.height} padding={PADDING} fontSize={16} align="center" verticalAlign="middle" wrap="word" ellipsis perfectDrawEnabled={false} />
        </>
      )}
      {el.type === "ellipse" && (
        <>
          <Ellipse x={el.width / 2} y={el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} fill={el.color} stroke="#1f232833" perfectDrawEnabled={false} />
          <Text text={text} width={el.width} height={el.height} padding={PADDING * 2} fontSize={16} align="center" verticalAlign="middle" wrap="word" ellipsis perfectDrawEnabled={false} />
        </>
      )}
      {el.type === "text" && (
        <>
          {/* Invisible hit area so empty or short text is still easy to grab. */}
          <Rect width={el.width} height={el.height} fill="transparent" />
          <Text text={text || (hideText ? "" : "Text")} width={el.width} fontSize={20} fill={el.text ? el.color : "#9aa0a6"} wrap="word" perfectDrawEnabled={false} />
        </>
      )}
    </Group>
  );
});
