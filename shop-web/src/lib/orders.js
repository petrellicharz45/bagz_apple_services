import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase.js";

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
    const res = await fetch("/api/order-status.php", {
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
