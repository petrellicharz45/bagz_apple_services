import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";

/**
 * Display order of main categories — Firestore settings/categoryOrder.list.
 * (settings/categories is a map, and Firestore does not keep map key order.)
 */
export async function loadCategoryOrder(db: Firestore): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, "settings", "categoryOrder"));
    const list = snap.exists() ? snap.data().list : null;
    return Array.isArray(list) ? list.filter((x: unknown) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function saveCategoryOrder(db: Firestore, list: string[]): Promise<void> {
  await setDoc(doc(db, "settings", "categoryOrder"), { list });
}

/** Names in saved order first; anything not in the order list follows alphabetically. */
export function sortByOrder(names: string[], order: string[]): string[] {
  const pos = new Map(order.map((n, i) => [n, i]));
  return [...names].sort((a, b) => {
    const pa = pos.has(a) ? pos.get(a)! : Number.MAX_SAFE_INTEGER;
    const pb = pos.has(b) ? pos.get(b)! : Number.MAX_SAFE_INTEGER;
    return pa - pb || a.localeCompare(b);
  });
}
