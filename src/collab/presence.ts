import type { Point } from "@/board/viewport";
import type { UserInfo } from "./user";

/**
 * What each client publishes through Yjs awareness. Awareness is ephemeral
 * (not stored in the document): it disappears when the client disconnects.
 */
export interface PresenceState {
  user?: UserInfo;
  /** Cursor in world coordinates, null when the pointer left the board. */
  cursor?: Point | null;
  /** Ids of the elements this user has selected. */
  selection?: string[];
}

export interface RemoteUser {
  clientId: number;
  user: UserInfo;
  cursor: Point | null;
  selection: string[];
}

/** Turn the raw awareness states into the list of *other* users to display. */
export function remoteUsers(states: Map<number, PresenceState>, localClientId: number): RemoteUser[] {
  const users: RemoteUser[] = [];
  states.forEach((state, clientId) => {
    if (clientId === localClientId || !state.user) return;
    users.push({ clientId, user: state.user, cursor: state.cursor ?? null, selection: state.selection ?? [] });
  });
  return users.sort((a, b) => a.clientId - b.clientId);
}

/**
 * Call `fn` at most once every `ms` milliseconds, always delivering the last
 * value (trailing call). Used for cursor updates: mousemove fires ~120 times
 * per second, 30 per second is plenty for a smooth remote cursor.
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  return (...args: A) => {
    pending = args;
    const wait = last + ms - Date.now();
    if (wait <= 0) {
      last = Date.now();
      pending = null;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        if (pending) fn(...pending);
        pending = null;
      }, wait);
    }
  };
}
