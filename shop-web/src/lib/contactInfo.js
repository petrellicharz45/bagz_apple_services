/** Bagz contact details from brand.js (no Firebase: also used by the build-time SEO script). */
import { BRAND } from "./brand.js";

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
