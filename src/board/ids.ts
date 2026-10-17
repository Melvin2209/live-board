/** Short, URL-safe random id used for boards and elements. */
export function randomId(size = 10): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}
