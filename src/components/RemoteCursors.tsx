"use client";

import { useSyncExternalStore } from "react";
import { Group, Label, Layer, Path, Rect, Tag, Text } from "react-konva";
import type { Awareness } from "y-protocols/awareness";
import type { BoardStore } from "@/board/store";
import { useRemoteUsers } from "@/collab/useRemoteUsers";

interface Props {
  awareness: Awareness;
  store: BoardStore;
  scale: number;
}

const CURSOR_PATH = "M0 0 L0 17 L4.5 12.5 L7.5 19.5 L10.5 18.2 L7.6 11.4 L13 11.4 Z";

/**
 * Other people's cursors and selections, on their own layer.
 * `listening={false}`: Konva skips hit-testing for this layer, and it is
 * redrawn independently from the (much bigger) elements layer.
 */
export function RemoteCursors({ awareness, store, scale }: Props) {
  // Subscribing here (and not in BoardCanvas) means a remote cursor move only
  // re-renders this small layer, never the 500 elements.
  const users = useRemoteUsers(awareness);
  // Also follow element changes so selection outlines move with their element.
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  // Cursors and labels keep the same on-screen size whatever the zoom level.
  const inverse = 1 / scale;
  return (
    <Layer listening={false}>
      {users.map(({ clientId, user, selection }) =>
        selection.map((id) => {
          const el = store.get(id);
          if (!el) return null;
          return (
            <Rect
              key={`${clientId}-${id}`}
              x={el.x - 4 * inverse}
              y={el.y - 4 * inverse}
              width={el.width + 8 * inverse}
              height={el.height + 8 * inverse}
              stroke={user.color}
              strokeWidth={2 * inverse}
              dash={[6 * inverse, 4 * inverse]}
              cornerRadius={4 * inverse}
            />
          );
        }),
      )}
      {users.map(({ clientId, user, cursor }) =>
        cursor ? (
          <Group key={clientId} x={cursor.x} y={cursor.y} scaleX={inverse} scaleY={inverse}>
            <Path data={CURSOR_PATH} fill={user.color} stroke="#fff" strokeWidth={1.5} />
            <Label x={14} y={18}>
              <Tag fill={user.color} cornerRadius={4} />
              <Text text={user.name} fill="#fff" fontSize={12} padding={4} />
            </Label>
          </Group>
        ) : null,
      )}
    </Layer>
  );
}
