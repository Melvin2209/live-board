"use client";

import Link from "next/link";
import type { Awareness } from "y-protocols/awareness";
import { useRemoteUsers } from "@/collab/useRemoteUsers";
import type { UserInfo } from "@/collab/user";

interface Props {
  boardId: string;
  user: UserInfo;
  onRename: (name: string) => void;
  awareness?: Awareness;
  children?: React.ReactNode;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TopBar({ boardId, user, onRename, awareness, children }: Props) {
  const others = useRemoteUsers(awareness);
  return (
    <header className="topbar">
      <div className="topbar-group">
        <Link href="/" className="logo">
          live-board
        </Link>
        <span className="board-id" title="Board id">
          {boardId}
        </span>
      </div>
      <div className="topbar-group">
        {children}
        <ul className="presence" data-testid="presence" aria-label="People on this board">
          {others.map(({ clientId, user: other }) => (
            <li key={clientId} className="avatar" style={{ background: other.color }} title={other.name} data-testid="presence-user">
              {initials(other.name)}
              <span className="sr-only">{other.name}</span>
            </li>
          ))}
        </ul>
        <label className="me" style={{ borderColor: user.color }}>
          <span className="dot" style={{ background: user.color }} />
          <input
            aria-label="Your name"
            data-testid="user-name"
            value={user.name}
            maxLength={32}
            onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </label>
      </div>
    </header>
  );
}
