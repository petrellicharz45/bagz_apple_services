const FALLBACK = "4 business days";

const LABELS = {
  2: "2 business days",
  3: "3 business days",
  5: "5 business days",
  7: "1 week",
  14: "2 weeks",
  30: "1 month",
  60: "2 months",
  90: "3 months"
};

export function deliveryEstimateText(product) {
  if (product?.deliveryEstimateLabel) return product.deliveryEstimateLabel;
  const days = Number(product?.deliveryEstimateDays);
  if (LABELS[days]) return LABELS[days];
  return FALLBACK;
}

export function deliveryBusinessDays(product) {
  const days = Number(product?.deliveryEstimateDays);
  if (days > 0) return days;
  const text = deliveryEstimateText(product);
  const match = String(text).match(/(\d+)/);
  return match ? Number(match[1]) : 4;
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

export function deliveryArrivalLine(product) {
  const est = deliveryEstimateText(product);
  if (est.includes("week") || est.includes("month")) return `Arrives in ${est}`;
  return `Arrives in ${est}`;
}
