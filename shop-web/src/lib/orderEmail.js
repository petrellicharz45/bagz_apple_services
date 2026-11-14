import { BRAND } from "./brand.js";

/**
 * Emails each new order to the shop through Web3Forms (https://web3forms.com, free plan),
 * so orders arrive by email without our own server. The access key only lets people send
 * to the email it was created for, so it is safe in the website code.
 * Set VITE_WEB3FORMS_KEY in shop-web/.env and .env.production; without it nothing is sent.
 */
const KEY = String(import.meta.env.VITE_WEB3FORMS_KEY || "").trim();

function ugx(n) {
  return `UGX ${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
}

export function orderEmailEnabled() {
  return Boolean(KEY);
}

/** Returns true when the email service accepted the message. Never throws. */
export async function emailNewOrder(order) {
  if (!KEY || !order?.orderId) return false;
  const lines = (order.items || []).map(
    (i) =>
      `• ${i.name}${i.color ? ` (${i.color})` : ""}${i.size ? ` [${i.size}]` : ""} × ${i.qty} = ${ugx(
        (Number(i.price) || 0) * (Number(i.qty) || 1)
      )}`
  );
  const message = [
    `New order ${order.orderId}`,
    `Payment: Cash on delivery`,
    "",
    `Customer: ${order.name}`,
    `Phone: ${order.phone}`,
    `Deliver to: ${order.address}`,
    order.note ? `Note: ${order.note}` : "",
    "",
    ...lines,
    "",
    `TOTAL: ${ugx(order.total)}`,
    "",
    `Call the customer to confirm, then update the order in the admin (Orders).`
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: KEY,
        subject: `New order ${order.orderId} · ${ugx(order.total)} · ${order.name}`,
        from_name: `${BRAND.name} shop`,
        message
      })
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(res.ok && data.success !== false);
  } catch (e) {
    console.warn("Order email failed:", e);
    return false;
  }
}
