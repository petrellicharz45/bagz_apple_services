/** Bagz contact numbers — used across shop UI and help pages. Values come from brand.js. */

import { writable } from "svelte/store";
import { BRAND } from "./brand.js";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export * from "./contactInfo.js";
import { SUPPORT_EMAIL, ORDER_WHATSAPP_E164 } from "./contactInfo.js";

/** Admin Settings → Customer Support. Empty call stays hidden until a number is saved. */
/** Platform → label + Font Awesome 4.7 icon (keep in sync with admin/src/lib/social.ts). */
export const SOCIAL_PLATFORMS = {
  instagram: { label: "Instagram", icon: "instagram" },
  facebook: { label: "Facebook", icon: "facebook-official" },
  x: { label: "X", icon: "twitter" },
  tiktok: { label: "TikTok", icon: "music" },
  whatsapp: { label: "WhatsApp", icon: "whatsapp" },
  snapchat: { label: "Snapchat", icon: "snapchat-ghost" },
  youtube: { label: "YouTube", icon: "youtube-play" },
  threads: { label: "Threads", icon: "at" },
  pinterest: { label: "Pinterest", icon: "pinterest" },
  linkedin: { label: "LinkedIn", icon: "linkedin-square" },
  telegram: { label: "Telegram", icon: "telegram" },
  other: { label: "Link", icon: "link" }
};

const isHttps = (u) => /^https:\/\/\S+$/i.test(String(u || "").trim());

function toLink(platform, url, label, icon) {
  const known = SOCIAL_PLATFORMS[platform];
  const info = known || SOCIAL_PLATFORMS.other;
  return {
    key: known ? platform : "other",
    // "Other" links show their own name and the icon chosen in the admin.
    name: known && platform !== "other" ? info.label : label || info.label,
    label: label || info.label,
    icon: (!known || platform === "other") && /^[a-z0-9-]+$/.test(icon || "") ? icon : info.icon,
    url: String(url).trim()
  };
}

/**
 * Social links for the footer. Accepts the admin list (settings/social.items: [{platform,url,label,active}])
 * or the older object form ({ instagram: "https://…" }). Only visible https links, in admin order.
 */
function cleanSocial(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((l) => l && l.active !== false && isHttps(l.url)).map((l) => toLink(l.platform, l.url, l.label, l.icon));
  }
  return Object.entries(raw || {})
    .filter(([, url]) => isHttps(url))
    .map(([platform, url]) => toLink(platform, url));
}

export const liveContact = writable({
  email: SUPPORT_EMAIL,
  whatsapp: ORDER_WHATSAPP_E164,
  call: "",
  /** @type {{ key: string, label: string, url: string }[]} */
  socials: cleanSocial(BRAND.social)
});

export async function loadLiveContact() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, "settings", "config"));
    const data = (snap.exists() && snap.data()) || {};
    const email = "supportEmail" in data ? String(data.supportEmail || "").trim() : SUPPORT_EMAIL;
    const whatsapp = "whatsappNumber" in data
      ? String(data.whatsappNumber || "").replace(/\D/g, "")
      : ORDER_WHATSAPP_E164;
    const call = "callNumber" in data ? String(data.callNumber || "").replace(/[^\d+]/g, "") : "";
    let socialSource = data.socialLinks || BRAND.social;
    try {
      const socialSnap = await getDoc(doc(db, "settings", "social"));
      if (socialSnap.exists() && Array.isArray(socialSnap.data().items)) socialSource = socialSnap.data().items;
    } catch {
      /* fall back to older settings */
    }
    liveContact.set({
      email: email || SUPPORT_EMAIL,
      whatsapp,
      call,
      socials: cleanSocial(socialSource)
    });
  } catch {
    /* Keep the numbers already in the shop. */
  }
}
