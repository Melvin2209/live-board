"use client";

import type { ElementType } from "@/board/model";

export type Tool = "select" | ElementType;

const TOOLS: { tool: Tool; label: string; icon: string; key: string }[] = [
  { tool: "select", label: "Select", icon: "↖", key: "V" },
  { tool: "sticky", label: "Sticky note", icon: "▤", key: "S" },
  { tool: "rect", label: "Rectangle", icon: "▭", key: "R" },
  { tool: "ellipse", label: "Ellipse", icon: "◯", key: "O" },
  { tool: "text", label: "Text", icon: "T", key: "T" },
];

export const COLORS = ["#fde68a", "#fca5a5", "#f9a8d4", "#c4b5fd", "#93c5fd", "#86efac", "#e5e7eb", "#1f2328"];

interface Props {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  selectedColor?: string;
  onColorChange: (color: string) => void;
  onDelete?: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function Toolbar(props: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Board tools">
      {TOOLS.map(({ tool, label, icon, key }) => (
        <button
          key={tool}
          type="button"
          className={props.tool === tool ? "active" : undefined}
          aria-pressed={props.tool === tool}
          title={`${label} (${key})`}
          data-testid={`tool-${tool}`}
          onClick={() => props.onToolChange(tool)}
        >
          {icon}
        </button>
      ))}

      {props.selectedColor !== undefined && (
        <>
          <span className="separator" />
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch${props.selectedColor === color ? " active" : ""}`}
              style={{ background: color }}
              title={`Color ${color}`}
              aria-label={`Color ${color}`}
              data-testid={`color-${color}`}
              onClick={() => props.onColorChange(color)}
            />
          ))}
          {props.onDelete && (
            <button type="button" title="Delete (Del)" data-testid="delete" onClick={props.onDelete}>
              🗑
            </button>
          )}
        </>
      )}

      <span className="separator" />
      <button type="button" title="Zoom out" data-testid="zoom-out" onClick={props.onZoomOut}>
        −
      </button>
      <button type="button" className="zoom-label" title="Reset zoom" data-testid="zoom-reset" onClick={props.onZoomReset}>
        {Math.round(props.zoom * 100)}%
      </button>
      <button type="button" title="Zoom in" data-testid="zoom-in" onClick={props.onZoomIn}>
        +
      </button>
    </div>
  );
}
