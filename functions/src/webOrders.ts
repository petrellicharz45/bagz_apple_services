import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Website checkout → `order/{orderId}` so web orders show in the admin like app orders.
 *
 * Web shoppers are not signed in to Firebase, so the shop cannot write `order` directly
 * (Firestore rules). This callable writes it with the Admin SDK instead:
 * - product names / photos / prices are re-read from Firestore (client values are not trusted);
 * - the order is always created as Pending + pending_payment (only the backend marks paid);
 * - `stockDeducted` is set when the web shop already deducted stock (shopDeductCatalogStock),
 *   so confirming the order in the admin does not deduct twice;
 * - idempotent per orderId.
 */

const ORDER_ID_RE = /^FD-\d{10,15}-[a-z0-9]{3,10}$/;
const MAX_ITEMS = 50;

type WebItem = { id?: string; qty?: number; size?: string; color?: string };

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

/** Same rule as the shop: offer % applies inside its optional start / end window. */
function unitPrice(product: admin.firestore.DocumentData, now: number): number {
  const price = Number(product.price) || 0;
  const off = Number(product.offerPercentage) || 0;
  const startOk = !product.saleStartAt || Number(product.saleStartAt) <= now;
  const endOk = !product.saleEndAt || Number(product.saleEndAt) > now;
  if (off > 0 && off < 100 && startOk && endOk) {
    return Math.round(price * (1 - off / 100));
  }
  return price;
}

/** Photo the customer picked (matched by name), else the cover photo. */
function photoForChoice(product: admin.firestore.DocumentData, choice: string) {
  const images: string[] = Array.isArray(product.images) ? product.images : [];
  const names: string[] = Array.isArray(product.imageNames) ? product.imageNames : [];
  const i = choice ? names.findIndex((n) => String(n || "").trim() === choice) : -1;
  if (i >= 0 && images[i]) return { name: String(names[i]).trim(), image: images[i] };
  return { name: "", image: product.cardImage || images[0] || "" };
}

export const shopCreateWebOrder = onCall({ cors: true }, async (request) => {
  const data = request.data || {};
  const orderId = cleanText(data.orderId, 40);
  if (!ORDER_ID_RE.test(orderId)) {
    throw new HttpsError("invalid-argument", "Invalid orderId");
  }
  const rawItems: WebItem[] = Array.isArray(data.items) ? data.items.slice(0, MAX_ITEMS) : [];
  if (!rawItems.length) {
    throw new HttpsError("invalid-argument", "Order has no items");
  }

  const db = admin.firestore();
  const orderRef = db.collection("order").doc(orderId);
  if ((await orderRef.get()).exists) {
    return { success: true, existing: true };
  }

  const now = Date.now();
  const products: Record<string, unknown>[] = [];
  let subtotal = 0;
  for (const row of rawItems) {
    const productId = cleanText(row.id, 128);
    const qty = Math.min(Math.max(Math.floor(Number(row.qty) || 1), 1), 500);
    if (!productId) continue;
    const snap = await db.collection("product").doc(productId).get();
    if (!snap.exists) continue;
    const p = snap.data() || {};
    const choice = cleanText(row.color, 200);
    const photo = photoForChoice(p, choice);
    const price = unitPrice(p, now);
    subtotal += price * qty;
    products.push({
      product: {
        id: productId,
        name: photo.name || String(p.name || ""),
        category: String(p.category || ""),
        price,
        images: photo.image ? [photo.image] : []
      },
      quantity: qty,
      selectedSize: cleanText(row.size, 40) || null,
      selectedColor: null,
      // Photo name / option the customer chose on the website.
      selectedColorName: choice || null
    });
  }
  if (!products.length) {
    throw new HttpsError("invalid-argument", "No valid products in order");
  }

  const name = cleanText(data.name, 100);
  const phone = cleanText(data.phone, 20);
  const addressText = cleanText(data.address, 300);
  const clientTotal = Math.max(0, Math.round(Number(data.total) || 0));
  const city = /kampala/i.test(addressText) ? "Kampala" : addressText.split(",")[0].trim();
  const stockDeducted = (await db.collection("stockDeductions").doc(orderId).get()).exists;

  await orderRef.set({
    orderId: Number(orderId.split("-")[1]) || now,
    orderStatus: "Pending",
    paymentStatus: "pending_payment",
    // What the website reported (wallet / mobile money); confirm in the admin.
    webPaymentReported: cleanText(data.status, 40),
    walletApplied: Math.max(0, Math.round(Number(data.walletApplied) || 0)),
    totalPrice: clientTotal || subtotal,
    itemsSubtotal: subtotal,
    priceMismatch: clientTotal > 0 && clientTotal < subtotal,
    products,
    address: {
      label: "Website",
      address: addressText,
      street: "",
      city,
      state: "",
      phone,
      latitude: 0,
      longitude: 0
    },
    customerName: name,
    customerPhone: phone,
    mobileMoneyName: name,
    mobileMoneyNumber: phone,
    currency: "UGX",
    userId: "",
    source: "shop-web",
    stockDeducted,
    date: new Date(now).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    timestamp: admin.firestore.Timestamp.fromMillis(now)
  });

  return { success: true };
});
