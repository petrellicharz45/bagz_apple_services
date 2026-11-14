import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { app, db } from "./firebase.js";
import { apiUrl } from "./appRuntime.js";

const KEY = "bagz_orders_v1";
const MAX = 40;

/**
 * Send a website order to the admin (Firestore `order`) via the shopCreateWebOrder function.
 * Never blocks checkout: the order is still kept in this browser if this fails.
 */
export async function submitWebOrder(order) {
  if (!app || !order?.orderId || !order.items?.length) return false;
  try {
    const fn = httpsCallable(getFunctions(app, "us-central1"), "shopCreateWebOrder");
    await fn({
      orderId: order.orderId,
      name: order.name,
      phone: order.phone,
      address: order.address,
      total: order.total,
      walletApplied: order.walletApplied,
      status: order.status,
      items: order.items.map((i) => ({ id: i.id, qty: i.qty, size: i.size, color: i.color }))
    });
    return true;
  } catch (e) {
    console.warn("Could not send order to admin:", e);
    return false;
  }
}

/**
 * Cash-on-delivery order → Firestore `order/{orderId}` directly (no Cloud Function needed;
 * firestore.rules `isValidCodWebOrder` only allows this exact shape, create-only).
 * Shows in Admin → Orders as Pending / cash_on_delivery. Returns true when saved.
 */
export async function submitCodOrder(order) {
  if (!db || !order?.orderId || !order.items?.length) return false;
  const now = Date.now();
  const products = order.items.slice(0, 50).map((i) => ({
    product: {
      id: String(i.id || ""),
      name: String(i.name || ""),
      category: String(i.category || ""),
      price: Math.max(0, Math.round(Number(i.price) || 0)),
      images: i.imageUrl ? [String(i.imageUrl)] : []
    },
    quantity: Math.min(Math.max(Math.floor(Number(i.qty) || 1), 1), 500),
    selectedSize: i.size || null,
    selectedColor: null,
    selectedColorName: i.color || null
  }));
  const subtotal = products.reduce((s, p) => s + p.product.price * p.quantity, 0);
  const addressText = String(order.address || "").slice(0, 300);
  const user = getAuth(app).currentUser;
  try {
    // Firestore waits (instead of failing) while offline; give up after 15 s so the customer
    // gets an answer. Retrying is safe: the rules refuse a second copy of the same order id.
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Order upload timed out")), 15000)
    );
    await Promise.race([timeout, setDoc(doc(db, "order", order.orderId), {
      orderId: Number(order.orderId.split("-")[1]) || now,
      orderStatus: "Pending",
      paymentStatus: "cash_on_delivery",
      paymentMethod: "Cash on delivery",
      totalPrice: Math.max(0, Math.round(Number(order.total) || subtotal)),
      itemsSubtotal: subtotal,
      products,
      address: {
        label: "Website",
        address: addressText,
        street: "",
        city: /kampala/i.test(addressText) ? "Kampala" : addressText.split(",").slice(-1)[0].trim(),
        state: "",
        phone: String(order.phone || ""),
        latitude: Number(order.location?.lat) || 0,
        longitude: Number(order.location?.lng) || 0
      },
      customerName: String(order.name || "").slice(0, 100),
      customerPhone: String(order.phone || "").slice(0, 20),
      customerEmail: String(user?.email || ""),
      currency: "UGX",
      userId: user?.uid || "",
      source: "shop-web",
      stockDeducted: false,
      // Prices were shown to the customer by the shop; staff confirm on the call.
      clientPriced: true,
      note: String(order.note || "").slice(0, 500),
      date: new Date(now).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      timestamp: serverTimestamp()
    })]);
    return true;
  } catch (e) {
    console.warn("Could not send cash-on-delivery order to admin:", e);
    return false;
  }
}

let syncing = false;

/**
 * Send every order in this browser the admin has not received yet — paid and attempted
 * (awaiting payment). Safe to repeat: the backend ignores orders it already has.
 */
export async function syncOrdersToAdmin() {
  if (syncing) return;
  syncing = true;
  try {
    for (const order of readOrders()) {
      if (order.sentToAdmin) continue;
      if (order.paymentMethod === "cod") {
        // Create-only rule: a retry of an order that already arrived is refused, so stop after a few.
        if ((order.sendAttempts || 0) >= 3) continue;
        const ok = await submitCodOrder(order);
        updateOrder(order.orderId, ok ? { sentToAdmin: true } : { sendAttempts: (order.sendAttempts || 0) + 1 });
        continue;
      }
      if (await submitWebOrder(order)) {
        updateOrder(order.orderId, { sentToAdmin: true });
      }
    }
  } finally {
    syncing = false;
  }
}

export function saveOrder(order) {
  if (!order?.orderId) return;
  try {
    const list = readOrders().filter((o) => o.orderId !== order.orderId);
    list.unshift({
      ...order,
      createdAt: order.createdAt || Date.now()
    });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function readOrders() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function updateOrder(orderId, patch) {
  if (!orderId) return readOrders();
  try {
    const list = readOrders().map((o) =>
      o.orderId === orderId ? { ...o, ...patch, orderId: o.orderId } : o
    );
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  } catch {
    return readOrders();
  }
}

/** True only after mobile money (or wallet) is confirmed — not after a PIN prompt trial alone. */
export function isOrderFullyPaid(order) {
  return order?.status === "paid";
}

/** Remaining balance the customer still owes on this order. */
export function orderAmountDue(order) {
  if (!order || isOrderFullyPaid(order)) return 0;
  const total = Number(order.total || 0);
  const paid = Number(order.amountPaid || 0);
  const due = Math.max(0, total - paid);
  // Older orders marked paid in amount fields but not status — still owe full total
  if (due <= 0 && total > 0) return total;
  return due;
}

/** Pay now stays until status is truly paid (failed or pending attempts do not remove it). */
export function isOrderPayable(order) {
  if (!order || isOrderFullyPaid(order)) return false;
  const due = orderAmountDue(order);
  const total = Number(order.total || 0);
  return due > 0 || total > 0;
}

export async function fetchOrderStatuses(orderIds) {
  const ids = (orderIds || []).filter(Boolean).slice(0, 20);
  if (!ids.length) return {};
  try {
    const res = await fetch(apiUrl("/api/order-status.php"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.orders || {};
  } catch {
    return {};
  }
}

export function formatOrderDate(ts) {
  try {
    return new Date(ts).toLocaleString("en-UG", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return "";
  }
}
