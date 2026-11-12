/**
 * Photo names: one name per gallery photo (e.g. "Black Versace T shirt"),
 * stored on the product as `imageNames`, index-aligned with `images`.
 * They drive the shop's option photos, description line and search.
 */

/** Colour tools are hidden in the admin; photo names replace them. Existing colour data is kept. */
export const SHOW_COLOR_TOOLS = false;

/** Trim names and align them to the number of saved photos ("" = unnamed). */
export function cleanImageNames(names: string[] | undefined | null, imageCount: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < imageCount; i++) {
    out.push(String(names?.[i] ?? "").trim());
  }
  return out;
}

/** Move one entry to the front, matching "set as Main photo". */
export function moveToFront<T>(list: T[], index: number): T[] {
  if (index <= 0 || index >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.unshift(item);
  return next;
}
