import { doc, getDoc } from "firebase/firestore/lite";
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
 * Banners: calls `onChange(list)` once loaded, and again when the visitor comes back to the tab
 * (so admin changes show up without a reload). Returns a stop function.
 * (The shop uses the small Firestore "lite" build, which has no live listeners.)
 */
export function watchHomeBanners(onChange) {
  if (!db) {
    onChange([]);
    return () => {};
  }
  let stopped = false;
  const load = () =>
    getDoc(doc(db, "settings", "banners"))
      .then((snap) => !stopped && onChange(cleanBanners(snap.exists() ? snap.data() : null)))
      .catch(() => !stopped && onChange(cachedHomeBanners())); // offline / blocked: keep the last known banners
  const onVisible = () => document.visibilityState === "visible" && load();
  load();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
  };
}
