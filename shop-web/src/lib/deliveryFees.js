import { writable, get } from "svelte/store";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

/** Global delivery fees (Admin → Delivery fees). Applied to all products unless free shipping. */
export const deliveryFeeSettings = writable({
  deliveryFeeKampala: null,
  deliveryFeeOutsideKampala: null,
  loaded: false
});

function parseFee(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function getDeliveryFeeSettings() {
  return get(deliveryFeeSettings);
}

export function globalDeliveryFee(zone = "kampala") {
  const s = getDeliveryFeeSettings();
  const raw =
    zone === "outside" ? s.deliveryFeeOutsideKampala : s.deliveryFeeKampala;
  return parseFee(raw);
}

export async function loadDeliveryFeeSettings() {
  if (!db) {
    deliveryFeeSettings.update((s) => ({ ...s, loaded: true }));
    return getDeliveryFeeSettings();
  }
  try {
    const snap = await getDoc(doc(db, "settings", "delivery_fees"));
    const data = snap.exists() ? snap.data() : {};
    const next = {
      deliveryFeeKampala: parseFee(data.deliveryFeeKampala),
      deliveryFeeOutsideKampala: parseFee(data.deliveryFeeOutsideKampala),
      loaded: true
    };
    deliveryFeeSettings.set(next);
    return next;
  } catch {
    deliveryFeeSettings.update((s) => ({ ...s, loaded: true }));
    return getDeliveryFeeSettings();
  }
}
