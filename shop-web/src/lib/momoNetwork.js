/** Detect MTN vs Airtel from common Uganda mobile prefixes. */

export function normalizeUgPhoneDigits(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("256")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * @returns {"mtn"|"airtel"|null}
 */
export function detectMobileNetwork(raw) {
  const d = normalizeUgPhoneDigits(raw);
  if (d.length < 9) return null;
  const p2 = d.slice(0, 2);
  if (["77", "78", "76", "39", "31"].includes(p2)) return "mtn";
  if (["70", "75", "74", "20"].includes(p2)) return "airtel";
  return null;
}

export function networkLabel(network) {
  if (network === "mtn") return "MTN Mobile Money";
  if (network === "airtel") return "Airtel Money";
  return "Mobile Money";
}
