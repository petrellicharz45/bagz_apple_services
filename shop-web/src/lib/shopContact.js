/** Bagz contact numbers — used across shop UI and help pages. Values come from brand.js. */

import { writable } from "svelte/store";
import { BRAND } from "./brand.js";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export const BUSINESS_EMAIL = BRAND.contact.email;
export const SUPPORT_EMAIL = BUSINESS_EMAIL;

/** Mobile support & phone orders. */
export const SUPPORT_PHONE_DISPLAY = BRAND.contact.phoneDisplay;
export const SUPPORT_PHONE_TEL = BRAND.contact.phoneTel;

/** Call-to-order line (product promotions). */
export const ORDER_PHONE_DISPLAY = SUPPORT_PHONE_DISPLAY;
export const ORDER_PHONE_TEL = SUPPORT_PHONE_TEL;

/** WhatsApp for orders (from your business lines). */
export const ORDER_WHATSAPP_E164 = BRAND.contact.whatsappE164;

export const BUSINESS_HOURS = BRAND.contact.hours;

export const BRANCHES = BRAND.branches;

/** @deprecated Use fields above; kept for help HTML templates. */
export const CONTACT = {
  email: SUPPORT_EMAIL,
  phone: SUPPORT_PHONE_DISPLAY,
  hours: BUSINESS_HOURS
};

/** Admin Settings → Customer Support. Empty call stays hidden until a number is saved. */
export const SOCIAL_LABELS = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  youtube: "YouTube"
};

/** Keep only https links for known networks, in a stable order. */
function cleanSocial(raw) {
  const out = [];
  for (const key of Object.keys(SOCIAL_LABELS)) {
    const url = String(raw?.[key] || "").trim();
    if (/^https:\/\/\S+$/i.test(url)) out.push({ key, label: SOCIAL_LABELS[key], url });
  }
  return out;
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
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const email = "supportEmail" in data ? String(data.supportEmail || "").trim() : SUPPORT_EMAIL;
    const whatsapp = "whatsappNumber" in data
      ? String(data.whatsappNumber || "").replace(/\D/g, "")
      : ORDER_WHATSAPP_E164;
    const call = "callNumber" in data ? String(data.callNumber || "").replace(/[^\d+]/g, "") : "";
    liveContact.set({
      email: email || SUPPORT_EMAIL,
      whatsapp,
      call,
      socials: cleanSocial({ ...BRAND.social, ...(data.socialLinks || {}) })
    });
  } catch {
    /* Keep the numbers already in the shop. */
  }
}
