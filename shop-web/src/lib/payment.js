import { apiUrl } from "./appRuntime.js";

/**
 * Web checkout — wire your MoMo/payment API via VITE_PAYMENT_API_URL in .env.
 */
export async function startPesapalCheckout(orderOrId) {
  const order = typeof orderOrId === "string" ? { orderId: orderOrId } : orderOrId;
  const endpoint = import.meta.env.DEV ? "/api/local-pesapal" : apiUrl("/api/pesapal-start.php");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        orderId: order.orderId,
        amount: order.amountDue,
        name: order.name,
        phone: order.phone,
        address: order.address,
        total: order.total,
        walletApplied: order.walletApplied,
        items: order.items || []
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.redirectUrl) {
    throw new Error(data.message || "Payment page did not open. Try again.");
  }
  return data.redirectUrl;
}

const API = import.meta.env.VITE_PAYMENT_API_URL || "";

export async function initiateMoMoPayment({ phone, amount, orderId, items }) {
  if (!API) {
    return {
      ok: false,
      pending: true,
      message:
        "Payment API not configured yet. Add VITE_PAYMENT_API_URL to shop-web/.env when your API is ready.",
      orderId
    };
  }
  const res = await fetch(`${API.replace(/\/$/, "")}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, amount, orderId, items, currency: "UGX" })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Payment failed (${res.status})`);
  }
  return res.json();
}

export function newOrderId() {
  return `FD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
