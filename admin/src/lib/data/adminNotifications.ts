import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "$lib/firebase";
import { isLowStockAlert, productStockBaseline } from "$lib/commerce/inventory";
import { isPaidOrder, orderTimestamp } from "$lib/commerce/orderSales";

export type AdminNotification = {
  id: string;
  type: "stock" | "order" | "user" | "payment" | "system";
  title: string;
  message: string;
  read: boolean;
  dedupeKey: string;
  href?: string;
  createdAt: Date | null;
  meta?: Record<string, unknown>;
};

function asDate(ts: unknown): Date | null {
  const t = ts as { seconds?: number };
  if (t?.seconds) return new Date(t.seconds * 1000);
  return null;
}

export async function fetchAdminNotifications(max = 60): Promise<AdminNotification[]> {
  const q = query(collection(db, "adminNotification"), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: (data.type as AdminNotification["type"]) || "system",
      title: String(data.title || ""),
      message: String(data.message || ""),
      read: data.read === true,
      dedupeKey: String(data.dedupeKey || d.id),
      href: data.href ? String(data.href) : undefined,
      createdAt: asDate(data.createdAt),
      meta: (data.meta as Record<string, unknown>) || {}
    };
  });
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, "adminNotification", id), { read: true });
}

export async function markAllNotificationsRead(items: AdminNotification[]) {
  const unread = items.filter((n) => !n.read);
  await Promise.all(unread.map((n) => markNotificationRead(n.id)));
}

async function upsertNotification(payload: Omit<AdminNotification, "id" | "createdAt"> & { id?: string }) {
  const id = payload.dedupeKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  const ref = doc(db, "adminNotification", id);
  await setDoc(
    ref,
    {
      type: payload.type,
      title: payload.title,
      message: payload.message,
      read: payload.read ?? false,
      dedupeKey: payload.dedupeKey,
      href: payload.href || "",
      meta: payload.meta || {},
      createdAt: Timestamp.now()
    },
    { merge: true }
  );
}

/** Create inbox items for stock, new orders, new users (idempotent per dedupeKey). */
export async function syncAdminNotifications(input: {
  products: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  users: { id: string; email?: string; createdAt?: unknown }[];
}) {
  const { products, orders, users } = input;
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const p of products) {
    const id = String((p as { id: string }).id || "");
    if (!id) continue;
    if (!isLowStockAlert(p)) continue;
    const stock = Number(p.stock ?? 0);
    const baseline = productStockBaseline(p);
    const pct = baseline > 0 ? Math.round((stock / baseline) * 100) : 0;
    await upsertNotification({
      type: "stock",
      title: stock <= 0 ? "Out of stock" : "Low stock (≤30% of baseline)",
      message: `${p.name}: ${stock} left (baseline ${baseline}, ${pct}% remaining)`,
      read: false,
      dedupeKey: `stock-${id}-${stock <= 0 ? "out" : "low"}`,
      href: `/inventory?q=${encodeURIComponent(String(p.name || ""))}`,
      meta: { productId: id, stock, baseline }
    });
  }

  for (const order of orders) {
    const at = orderTimestamp(order);
    if (at && at.getTime() < since) continue;
    const orderId = String(order.orderId || order.id || "");
    if (!orderId) continue;
    const paid = isPaidOrder(order);
    const total = Number(order.totalPrice || 0);
    await upsertNotification({
      type: paid ? "payment" : "order",
      title: paid ? "Sale completed" : "New order placed",
      message: `Order #${String(orderId).slice(-8)} — UGX ${Math.round(total).toLocaleString("en-UG")}${
        paid ? " (paid)" : " (awaiting payment)"
      }`,
      read: false,
      dedupeKey: `order-${orderId}-${paid ? "paid" : "new"}`,
      href: `/orders/${order.id || orderId}`,
      meta: { orderId, paid, total }
    });
  }

  for (const u of users) {
    const created = asDate(u.createdAt);
    if (!created || created.getTime() < since) continue;
    await upsertNotification({
      type: "user",
      title: "New customer registered",
      message: u.email || u.id,
      read: false,
      dedupeKey: `user-${u.id}`,
      href: "/system-insights?type=user",
      meta: { userId: u.id }
    });
  }
}

export function unreadCount(items: AdminNotification[]) {
  return items.filter((n) => !n.read).length;
}
