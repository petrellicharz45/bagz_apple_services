import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { buildStockUpdates } from "./stockUtil";

function isPaidStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase().replace(/_/g, " ");
  return s === "paid" || s.includes("paid");
}

async function deductOrderLines(
  products: { product?: { id?: string }; quantity?: number; qty?: number }[]
) {
  const batch = admin.firestore().batch();
  let updates = 0;
  for (const item of products) {
    const productId = item.product?.id;
    const qty = Number(item.quantity ?? item.qty ?? 0);
    if (!productId || qty <= 0) continue;
    const productRef = admin.firestore().collection("product").doc(String(productId));
    const productDoc = await productRef.get();
    if (!productDoc.exists) continue;
    const stockUpdates = buildStockUpdates(productDoc, item as Record<string, unknown>, -qty);
    batch.update(productRef, stockUpdates);
    updates += 1;
  }
  if (updates > 0) await batch.commit();
  return updates;
}

/** Web shop: idempotent stock decrement after a paid checkout (orderId dedupes retries). */
export const shopDeductCatalogStock = onCall({ cors: true }, async (request) => {
  const { orderId, items } = request.data || {};
  if (!orderId || !Array.isArray(items) || !items.length) {
    throw new HttpsError("invalid-argument", "orderId and items are required");
  }
  const dedupeRef = admin.firestore().collection("stockDeductions").doc(String(orderId));
  const existing = await dedupeRef.get();
  if (existing.exists) {
    return { success: true, skipped: true };
  }

  const lines = items.map((row: { id?: string; productId?: string; qty?: number }) => ({
    product: { id: row.productId || row.id },
    quantity: Math.min(Math.max(Number(row.qty) || 1, 1), 500)
  }));

  const count = await deductOrderLines(lines);
  await dedupeRef.set({
    orderId: String(orderId),
    source: "shop-web",
    lines: count,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  // If the web order is already in `order`, stop the admin from deducting again on Confirm.
  const orderRef = admin.firestore().collection("order").doc(String(orderId));
  if ((await orderRef.get()).exists) {
    await orderRef.update({ stockDeducted: true });
  }
  return { success: true, lines: count };
});

/** App / admin: when payment becomes Paid, deduct stock once. */
export const syncStockOnOrderPaid = onDocumentUpdated("order/{orderId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (after.stockDeducted === true) return;
  if (!isPaidStatus(after.paymentStatus)) return;
  if (isPaidStatus(before.paymentStatus)) return;

  const products = (after.products || []) as { product?: { id?: string }; quantity?: number }[];
  if (!products.length) return;

  await deductOrderLines(products);
  await event.data!.after.ref.update({ stockDeducted: true });
});
