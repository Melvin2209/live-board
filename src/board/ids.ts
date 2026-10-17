/** Board ids come from the URL: keep them short and URL-safe. */
export const BOARD_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

export function isValidBoardId(id: string): boolean {
  return BOARD_ID_PATTERN.test(id);
}

/** Short, URL-safe random id used for boards and elements. */
export function randomId(size = 10): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}
