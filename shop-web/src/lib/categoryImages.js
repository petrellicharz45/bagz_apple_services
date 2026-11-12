import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

const RESERVED_SETTINGS_KEYS = new Set(["recommended"]);

/** Admin-managed category order (settings/categoryOrder.list). */
export async function loadCategoryOrder() {
  if (!db) return [];
  try {
    const snap = await getDoc(doc(db, "settings", "categoryOrder"));
    const list = snap.exists() ? snap.data().list : null;
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Names in admin order first; the rest alphabetically. */
export function sortByOrder(names, order = []) {
  const pos = new Map(order.map((n, i) => [n, i]));
  return [...names].sort((a, b) => {
    const pa = pos.has(a) ? pos.get(a) : Number.MAX_SAFE_INTEGER;
    const pb = pos.has(b) ? pos.get(b) : Number.MAX_SAFE_INTEGER;
    return pa - pb || a.localeCompare(b);
  });
}

/** Parse settings/categories — keys are category names; values may be true or an image URL. */
export function categoryKeysFromSettings(data) {
  if (!data || typeof data !== "object") return [];
  return Object.keys(data).filter(
    (k) => k && !k.startsWith("_") && !RESERVED_SETTINGS_KEYS.has(k.toLowerCase())
  );
}

export function imageMapFromSettings(data) {
  const images = {};
  if (!data || typeof data !== "object") return images;
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "string" && /^https?:\/\//i.test(val.trim())) {
      images[key] = val.trim();
    }
  }
  return images;
}
