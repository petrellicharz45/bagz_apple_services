/** Paid / completed sales only — pending checkouts are not revenue. */

export function isPaidOrder(order: Record<string, unknown> | null | undefined): boolean {
  if (!order) return false;
  const pay = String(order.paymentStatus || "").toLowerCase().replace(/_/g, " ");
  if (pay === "paid" || pay.includes("paid")) return true;
  if (order.isPaid === true) return true;
  const paidAmt = Number(order.amountPaid || 0);
  const total = Number(order.totalPrice || order.total || 0);
  if (paidAmt > 0 && total > 0 && paidAmt >= total * 0.99) return true;
  return false;
}

export function orderTimestamp(order: Record<string, unknown>): Date | null {
  const ts = order.timestamp as { seconds?: number } | number | string | undefined;
  if (ts && typeof ts === "object" && ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  const created = order.createdAt;
  if (typeof created === "number") return new Date(created);
  return null;
}

export type SaleLine = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  image?: string;
  category?: string;
};

export function extractOrderLines(order: Record<string, unknown>): SaleLine[] {
  const lines: SaleLine[] = [];
  const items = (order.products || order.items || []) as Record<string, unknown>[];
  for (const item of items) {
    const product = (item.product || item) as Record<string, unknown>;
    const productId = String(product.id || product.productId || item.productId || product.name || "");
    if (!productId) continue;
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const unitPrice = Number(
      item.price ?? product.price ?? product.currentPrice ?? 0
    );
    lines.push({
      productId,
      name: String(product.name || item.name || "Product"),
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
      image: (product.images as string[])?.[0] || (item.imageUrl as string),
      category: String(product.category || "")
    });
  }
  return lines;
}

export function paidOrdersOnly(orders: Record<string, unknown>[]) {
  return orders.filter((o) => isPaidOrder(o));
}

export function salesTotal(orders: Record<string, unknown>[]) {
  return paidOrdersOnly(orders).reduce((sum, o) => sum + Number(o.totalPrice || o.total || 0), 0);
}

export function salesTodayTotal(orders: Record<string, unknown>[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return paidOrdersOnly(orders)
    .filter((o) => {
      const d = orderTimestamp(o);
      return d && d >= start;
    })
    .reduce((sum, o) => sum + Number(o.totalPrice || o.total || 0), 0);
}

export type ProductSalesAgg = {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  orderCount: number;
  image?: string;
  category?: string;
  buyers: { orderId: string; userId: string; phone: string; name: string; qty: number; at: Date | null }[];
};

export function aggregateProductSales(orders: Record<string, unknown>[]): ProductSalesAgg[] {
  const map = new Map<string, ProductSalesAgg>();
  for (const order of paidOrdersOnly(orders)) {
    const orderId = String((order as { id?: string }).id || order.orderId || "");
    const userId = String(order.userId || "");
    const phone = String(
      (order as { customerPhone?: string }).customerPhone ||
        (order.address as { phone?: string })?.phone ||
        ""
    );
    const name = String(
      (order.address as { fullName?: string })?.fullName ||
        (order as { mobileMoneyName?: string }).mobileMoneyName ||
        "Customer"
    );
    const at = orderTimestamp(order);
    for (const line of extractOrderLines(order)) {
      let agg = map.get(line.productId);
      if (!agg) {
        agg = {
          productId: line.productId,
          name: line.name,
          qty: 0,
          revenue: 0,
          orderCount: 0,
          image: line.image,
          category: line.category,
          buyers: []
        };
        map.set(line.productId, agg);
      }
      agg.qty += line.qty;
      agg.revenue += line.lineTotal;
      agg.orderCount += 1;
      agg.buyers.push({ orderId, userId, phone, name, qty: line.qty, at });
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

export function buildDailySalesSeries(orders: Record<string, unknown>[], days = 14) {
  const buckets = Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      total: 0,
      orders: 0
    };
  });
  for (const order of paidOrdersOnly(orders)) {
    const dt = orderTimestamp(order);
    if (!dt) continue;
    const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).toISOString().slice(0, 10);
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) {
      bucket.total += Number(order.totalPrice || order.total || 0);
      bucket.orders += 1;
    }
  }
  return buckets;
}

export function categoryPieParts(aggs: ProductSalesAgg[]) {
  const byCat: Record<string, number> = {};
  for (const a of aggs) {
    const c = a.category || "Uncategorized";
    byCat[c] = (byCat[c] || 0) + a.revenue;
  }
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return entries.map(([label, value]) => ({ label, value, pct: (value / total) * 100 }));
}
