/** Fancy Deals contact numbers — used across shop UI and help pages. */

import { writable } from "svelte/store";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export const BUSINESS_EMAIL = "fancydeals480@gmail.com";
export const SUPPORT_EMAIL = BUSINESS_EMAIL;

/** Mobile support & phone orders. */
export const SUPPORT_PHONE_DISPLAY = "+256 752 918 710";
export const SUPPORT_PHONE_TEL = "+256752918710";

/** Call-to-order line (product promotions). */
export const ORDER_PHONE_DISPLAY = SUPPORT_PHONE_DISPLAY;
export const ORDER_PHONE_TEL = SUPPORT_PHONE_TEL;

/** WhatsApp for orders (from your business lines). */
export const ORDER_WHATSAPP_E164 = "256200804010";

export const BUSINESS_HOURS = "Mon–Sat, 9:00–18:00 EAT";

/** @deprecated Use fields above; kept for help HTML templates. */
export const CONTACT = {
  email: SUPPORT_EMAIL,
  phone: SUPPORT_PHONE_DISPLAY,
  hours: BUSINESS_HOURS
};

/** Admin Settings → Customer Support. Empty call stays hidden until a number is saved. */
export const liveContact = writable({
  email: SUPPORT_EMAIL,
  whatsapp: ORDER_WHATSAPP_E164,
  call: ""
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
      call
    });
  } catch {
    /* Keep the numbers already in the shop. */
  }
}
