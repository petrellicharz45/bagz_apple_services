import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Home page slider banners managed in Admin → Home Banners
 * (Firestore settings/banners.items). Only active banners, in admin order.
 */
function cleanBanners(data) {
  const items = data && Array.isArray(data.items) ? data.items : [];
  return items
    .filter((b) => b && b.active !== false && /^https:\/\//i.test(String(b.imageUrl || "")))
    .map((b, i) => ({
      id: String(b.id || i),
      imageUrl: String(b.imageUrl),
      mobileImageUrl: /^https:\/\//i.test(String(b.mobileImageUrl || "")) ? String(b.mobileImageUrl) : "",
      caption: String(b.caption || ""),
      link: String(b.link || "")
    }));
}

const CACHE_KEY = "bagz_home_banners_v1";

/** Banners from the previous visit (instant first paint); [] if none or storage is blocked. */
export function cachedHomeBanners() {
  try {
    const list = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    return Array.isArray(list) ? list.filter((b) => b && /^https:\/\//i.test(String(b.imageUrl || ""))) : [];
  } catch {
    return [];
  }
}

export function cacheHomeBanners(list) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list || []));
  } catch {
    /* private mode / storage full: just no instant paint next time */
  }
}

export async function loadHomeBanners() {
  if (!db) return [];
  try {
    const snap = await getDoc(doc(db, "settings", "banners"));
    return cleanBanners(snap.exists() ? snap.data() : null);
  } catch {
    return [];
  }
}

/**
 * Live banners: calls `onChange(list)` now and whenever an admin adds, edits,
 * hides, reorders or deletes a banner. Returns an unsubscribe function.
 */
export function watchHomeBanners(onChange) {
  if (!db) {
    onChange([]);
    return () => {};
  }
  try {
    return onSnapshot(
      doc(db, "settings", "banners"),
      (snap) => onChange(cleanBanners(snap.exists() ? snap.data() : null)),
      () => onChange(cachedHomeBanners()) // offline / blocked: keep the last known banners
    );
  } catch {
    loadHomeBanners().then(onChange);
    return () => {};
  }
}
