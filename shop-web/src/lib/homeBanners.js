import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Home page slider banners managed in Admin → Home Banners
 * (Firestore settings/banners.items). Returns only active banners, in admin order.
 */
export async function loadHomeBanners() {
  if (!db) return [];
  try {
    const snap = await getDoc(doc(db, "settings", "banners"));
    const items = snap.exists() ? snap.data().items : [];
    if (!Array.isArray(items)) return [];
    return items
      .filter((b) => b && b.active !== false && /^https:\/\//i.test(String(b.imageUrl || "")))
      .map((b, i) => ({
        id: String(b.id || i),
        imageUrl: String(b.imageUrl),
        mobileImageUrl: /^https:\/\//i.test(String(b.mobileImageUrl || "")) ? String(b.mobileImageUrl) : "",
        caption: String(b.caption || ""),
        link: String(b.link || "")
      }));
  } catch {
    return [];
  }
}
