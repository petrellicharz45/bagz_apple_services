import { addBusinessDays, deliveryBusinessDays } from "./delivery.js";
import { formatOrderDate } from "./orders.js";

const LABELS = {
  pending: "Confirmed",
  confirmed: "Confirmed",
  shipped: "Shipping",
  delivered: "Delivered",
  canceled: "Cancelled",
  cancelled: "Cancelled"
};

function millisOf(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function longestShipDays(order) {
  const items = order?.items || [];
  let days = 0;
  for (const item of items) {
    days = Math.max(days, deliveryBusinessDays(item.product || item));
  }
  return days || 4;
}

/** Shop label, the time the admin set it, and the shipping deadline. */
export function describeFulfillment(order, remote) {
  const raw = String(remote?.orderStatus || "Pending").toLowerCase();
  const label = LABELS[raw] || "Confirmed";
  const confirmedAt = millisOf(remote?.confirmedAt) || (label === "Confirmed" ? 0 : 0);
  const shippedAt = millisOf(remote?.shippedAt);
  const deliveredAt = millisOf(remote?.deliveredAt);
  const canceledAt = millisOf(remote?.canceledAt);
  const setAt =
    raw === "shipped" ? shippedAt :
    raw === "delivered" ? deliveredAt :
    raw === "canceled" || raw === "cancelled" ? canceledAt :
    confirmedAt;
  const start = confirmedAt || millisOf(order?.createdAt);
  const deadline = start ? addBusinessDays(start, longestShipDays(order)) : null;
  let window = "";
  if (label === "Confirmed" && !confirmedAt) {
    window = `Ships within ${longestShipDays(order)} business days after confirmation`;
  } else if (label === "Confirmed" || label === "Shipping") {
    window = deadline ? `Ship by ${formatOrderDate(deadline.getTime())}` : "";
  }
  return {
    label,
    when: setAt ? formatOrderDate(setAt) : "",
    window
  };
}
