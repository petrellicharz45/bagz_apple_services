// @ts-nocheck: plain JS shared by the Svelte shop and the TypeScript admin.
/**
 * Order emails for Bagz (shop + admin), sent with EmailJS (https://www.emailjs.com) through the
 * info@bagzappleservices.com mailbox. The layout lives in the EmailJS template
 * (docs/emailjs-order-template.html); this file only fills in plain values, so the public key
 * cannot be used to send arbitrary HTML from the Bagz mailbox.
 *
 * Order shape (normalise before calling):
 *   { ref, date, name, email, phone, address, note, total, paymentLabel,
 *     items: [{ name, qty, price, image, option }] }
 */

const MAX_ITEMS = 4;

export function formatUgx(n) {
  return `UGX ${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
}

const STATUS = {
  received: {
    label: "Order received",
    color: "#1673c4",
    heading: (o) => `Thank you, ${firstName(o.name)}! We've received your order.`,
    intro: () =>
      "We'll call you shortly to confirm your order and delivery time. Same-day delivery in Kampala, upcountry 1–3 days."
  },
  new_order: {
    label: "New order",
    color: "#1673c4",
    heading: (o) => `New order from ${o.name}`,
    intro: (o) => `Call ${o.phone} to confirm, then update the order in Admin → Orders.`
  },
  Confirmed: {
    label: "Confirmed",
    color: "#1673c4",
    heading: (o) => `Good news, ${firstName(o.name)}: your order is confirmed.`,
    intro: () => "We're preparing it now and will let you know when it's on the way."
  },
  Shipped: {
    label: "On the way",
    color: "#e08a00",
    heading: (o) => `Your order is on the way, ${firstName(o.name)}!`,
    intro: () => "Our rider will call you on arrival. Please check your item before paying."
  },
  Delivered: {
    label: "Delivered",
    color: "#1a8a4a",
    heading: (o) => `Delivered: enjoy your new gadget, ${firstName(o.name)}!`,
    intro: () =>
      "Thank you for shopping with Bagz. Your warranty starts today; keep this email as your receipt. Happy with your order? A quick Google review helps other customers find us."
  },
  Canceled: {
    label: "Cancelled",
    color: "#c0392b",
    heading: (o) => `Your order has been cancelled, ${firstName(o.name)}.`,
    intro: () => "If this is unexpected, call or WhatsApp us and we'll sort it out."
  },
  paid: {
    label: "Payment received",
    color: "#1a8a4a",
    heading: (o) => `Payment received, thank you ${firstName(o.name)}!`,
    intro: (o) => `We've received ${formatUgx(o.total)} for this order.`
  }
};

/** Status keys that send a customer email (admin "Pending" changes do not). */
export const CUSTOMER_EMAIL_STATUSES = ["received", "Confirmed", "Shipped", "Delivered", "Canceled", "paid"];

function firstName(name) {
  return String(name || "there").trim().split(/\s+/)[0] || "there";
}

/**
 * Template parameters for one email. `kind` = a STATUS key.
 * @param {string} kind
 * @param {any} order
 * @param {{ toEmail: string, toName?: string, replyTo?: string, brand: { name: string, phone: string, whatsapp: string, email: string, reviewUrl?: string } }} opts
 * @returns {Record<string, string>}
 */
export function orderEmailParams(kind, order, { toEmail, toName, replyTo, brand }) {
  const s = STATUS[kind] || STATUS.received;
  const items = (order.items || []).filter(Boolean);
  const params = {
    to_email: toEmail,
    to_name: toName || order.name || "",
    reply_to: replyTo || brand.email,
    subject:
      kind === "new_order"
        ? `New order ${order.ref} · ${formatUgx(order.total)} · ${order.name}`
        : `${s.label}: your Bagz order ${order.ref}`,
    status_label: s.label,
    status_color: s.color,
    heading: s.heading(order),
    intro: s.intro(order),
    order_id: order.ref,
    order_date: order.date || "",
    payment: order.paymentLabel || "Cash on delivery",
    total: formatUgx(order.total),
    customer: `${order.name || ""} · ${order.phone || ""}`.trim(),
    address: order.address || "",
    note: order.note ? `Note: ${order.note}` : "",
    more_items: items.length > MAX_ITEMS ? `+ ${items.length - MAX_ITEMS} more item(s)` : "",
    // "Leave a Google review" button: only on the Delivered email, when there is a review link.
    review_url: brand.reviewUrl || "",
    review_display: kind === "Delivered" && brand.reviewUrl ? "inline-block" : "none",
    shop_name: brand.name,
    shop_phone: brand.phone,
    shop_whatsapp: `https://wa.me/${brand.whatsapp}`,
    shop_email: brand.email
  };
  for (let i = 0; i < MAX_ITEMS; i++) {
    const it = items[i];
    const n = i + 1;
    params[`item${n}_display`] = it ? "table-row" : "none";
    params[`item${n}_image`] = it && /^https:\/\//i.test(String(it.image || "")) ? it.image : "";
    params[`item${n}_name`] = it ? String(it.name || "") : "";
    params[`item${n}_meta`] = it
      ? [it.option, `Qty ${it.qty || 1}`, formatUgx((Number(it.price) || 0) * (Number(it.qty) || 1))]
          .filter(Boolean)
          .join(" · ")
      : "";
  }
  return params;
}

export function emailJsConfigured(cfg) {
  return Boolean(cfg && cfg.serviceId && cfg.templateId && cfg.publicKey);
}

/** Sends one email; resolves true/false, never throws. Gives up after 15 s. */
export async function sendEmailJs(cfg, params) {
  if (!emailJsConfigured(cfg) || !params?.to_email) return false;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: params
      }),
      signal: controller?.signal
    });
    if (!res.ok) console.warn("EmailJS:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.warn("EmailJS failed:", e);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
