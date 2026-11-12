/** Parse optional UGX delivery fee from admin form input. */
export function parseDeliveryFeeInput(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
