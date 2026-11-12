/**
 * Delivery wording for Bagz Apple Services.
 * In-stock items: same-day in Kampala; upcountry depends on distance (usually 1–3 days).
 * Items the admin gives a long lead time (1 week or more — pre-orders, special orders) show that instead.
 */
export const KAMPALA_DELIVERY = "Same-day delivery in Kampala";
export const KAMPALA_DELIVERY_SHORT = "Same-day in Kampala";
export const UPCOUNTRY_DELIVERY = "Upcountry · 1–3 days, depends on distance";
export const DELIVERY_PROMISE = "Same-day delivery in Kampala · upcountry 1–3 days, depending on distance";

/** Admin lead times that mean "special order" rather than normal stock. */
const LONG_LABELS = {
  7: "1 week",
  14: "2 weeks",
  30: "1 month",
  60: "2 months",
  90: "3 months"
};

/** Lead time set in the admin for special orders, or null for normal (same-day) stock. */
export function specialOrderLeadTime(product) {
  const days = Number(product?.deliveryEstimateDays);
  if (LONG_LABELS[days]) return LONG_LABELS[days];
  const label = String(product?.deliveryEstimateLabel || "");
  return /week|month/i.test(label) ? label : null;
}

/**
 * Delivery text for product pages, checkout and orders.
 * zone: "kampala" | "outside" when known; otherwise both are shown.
 */
export function deliveryEstimateText(product, zone = null) {
  const special = specialOrderLeadTime(product);
  if (special) return `Ships in ${special}`;
  if (zone === "kampala") return KAMPALA_DELIVERY;
  if (zone === "outside") return UPCOUNTRY_DELIVERY;
  return DELIVERY_PROMISE;
}

/** Business days used for order ETA maths (0 = same day). */
export function deliveryBusinessDays(product, zone = "kampala") {
  const days = Number(product?.deliveryEstimateDays);
  if (specialOrderLeadTime(product)) return days > 0 ? days : 7;
  return zone === "outside" ? 3 : 0;
}

/** Skip Sundays. Counts from the day after `startMs`. */
export function addBusinessDays(startMs, days) {
  const d = new Date(startMs);
  let left = Math.max(0, Number(days) || 0);
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left -= 1;
  }
  return d;
}

/** Short line under product cards. */
export function deliveryArrivalLine(product) {
  const special = specialOrderLeadTime(product);
  if (special) return `Ships in ${special}`;
  return `${KAMPALA_DELIVERY_SHORT} · upcountry 1–3 days`;
}
