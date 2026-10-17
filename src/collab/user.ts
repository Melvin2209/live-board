/** Local identity shown to collaborators. There are no accounts: it lives in localStorage. */
export interface UserInfo {
  name: string;
  color: string;
}

export const USER_COLORS = ["#e11d48", "#d97706", "#059669", "#0284c7", "#7c3aed", "#db2777", "#4f46e5", "#0d9488"];

const ADJECTIVES = ["Curious", "Brave", "Calm", "Swift", "Clever", "Happy", "Bold", "Quiet", "Witty", "Lucky"];
const ANIMALS = ["Otter", "Fox", "Panda", "Falcon", "Koala", "Lynx", "Heron", "Badger", "Whale", "Gecko"];

const STORAGE_KEY = "live-board:user";

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

export function randomUser(random: () => number = Math.random): UserInfo {
  return { name: `${pick(ADJECTIVES, random)} ${pick(ANIMALS, random)}`, color: pick(USER_COLORS, random) };
}

export function loadUser(storage: Pick<Storage, "getItem" | "setItem"> = localStorage): UserInfo {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
    if (typeof saved?.name === "string" && typeof saved?.color === "string") return saved;
  } catch {
    // corrupted value: fall through and create a new identity
  }
  const user = randomUser();
  saveUser(user, storage);
  return user;
}

export function saveUser(user: UserInfo, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(user));
}
