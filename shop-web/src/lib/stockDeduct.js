import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase.js";

const REGION = "us-central1";

/** Reduce Firestore stock after a paid web checkout (idempotent per orderId). */
export async function deductStockForWebOrder(orderId, items) {
  if (!app || !orderId || !items?.length) return;
  try {
    const functions = getFunctions(app, REGION);
    const fn = httpsCallable(functions, "shopDeductCatalogStock");
    await fn({
      orderId,
      items: items.map((l) => ({
        productId: l.id || l.productId,
        qty: l.qty
      }))
    });
  } catch (e) {
    console.warn("Stock deduct failed (catalog may refresh on next load):", e);
  }
}
