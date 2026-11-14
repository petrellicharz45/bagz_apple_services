import { BRAND } from "./brand.js";
import { orderEmailParams, sendEmailJs, emailJsConfigured, formatUgx } from "../../../shared/orderEmail.js";

/**
 * Order emails from the shop:
 * - customer "Order received" + shop "New order" (with product photos) via EmailJS
 *   (VITE_EMAILJS_SERVICE_ID / VITE_EMAILJS_TEMPLATE_ID / VITE_EMAILJS_PUBLIC_KEY);
 * - the shop copy falls back to Web3Forms (VITE_WEB3FORMS_KEY, plain text) when EmailJS is not
 *   set up or fails, so staff always hear about an order.
 */
const EMAILJS = {
  serviceId: String(import.meta.env.VITE_EMAILJS_SERVICE_ID || "").trim(),
  templateId: String(import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "").trim(),
  publicKey: String(import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "").trim()
};
const WEB3FORMS_KEY = String(import.meta.env.VITE_WEB3FORMS_KEY || "").trim();
const SHOP_INBOX = String(import.meta.env.VITE_ORDER_NOTIFY_EMAIL || BRAND.contact.email).trim();

const BRAND_INFO = {
  name: BRAND.name,
  phone: BRAND.contact.phoneDisplay,
  whatsapp: BRAND.contact.whatsappE164,
  email: BRAND.contact.email
};

export function orderEmailEnabled() {
  return emailJsConfigured(EMAILJS) || Boolean(WEB3FORMS_KEY);
}

/** Shop checkout order → common email shape. */
function normalise(order) {
  return {
    ref: order.orderId,
    date: new Date(order.createdAt || Date.now()).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" }),
    name: order.name,
    email: order.email || "",
    phone: order.phone,
    address: order.address,
    note: order.note || "",
    total: order.total,
    paymentLabel: order.paymentMethod === "cod" || !order.paymentMethod ? "Cash on delivery" : "Paid online",
    items: (order.items || []).map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      image: i.imageUrl,
      option: [i.color, i.size].filter((x) => x && x !== "Default" && x !== "One size").join(" · ")
    }))
  };
}

async function web3formsShopCopy(order) {
  if (!WEB3FORMS_KEY) return false;
  const o = normalise(order);
  const lines = o.items.map(
    (i) => `• ${i.name}${i.option ? ` (${i.option})` : ""} × ${i.qty} = ${formatUgx((Number(i.price) || 0) * (Number(i.qty) || 1))}${i.image ? `\n  Photo: ${i.image}` : ""}`
  );
  const message = [
    `New order ${o.ref}`,
    `Payment: ${o.paymentLabel}`,
    "",
    `Customer: ${o.name}`,
    `Phone: ${o.phone}`,
    o.email ? `Email: ${o.email}` : "",
    `Deliver to: ${o.address}`,
    o.note ? `Note: ${o.note}` : "",
    "",
    ...lines,
    "",
    `TOTAL: ${formatUgx(o.total)}`,
    "",
    "Call the customer to confirm, then update the order in the admin (Orders)."
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `New order ${o.ref} · ${formatUgx(o.total)} · ${o.name}`,
        from_name: `${BRAND.name} shop`,
        ...(o.email ? { replyto: o.email } : {}),
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

/**
 * Emails for a new order. Resolves { shop, customer } (true = sent). Never throws.
 */
export async function emailNewOrder(order) {
  if (!order?.orderId) return { shop: false, customer: false };
  const o = normalise(order);
  const [shopViaEmailJs, customer] = await Promise.all([
    sendEmailJs(
      EMAILJS,
      orderEmailParams("new_order", o, { toEmail: SHOP_INBOX, toName: BRAND.name, replyTo: o.email || BRAND.contact.email, brand: BRAND_INFO })
    ),
    o.email
      ? sendEmailJs(EMAILJS, orderEmailParams("received", o, { toEmail: o.email, toName: o.name, brand: BRAND_INFO }))
      : Promise.resolve(false)
  ]);
  const shop = shopViaEmailJs || (await web3formsShopCopy(order));
  return { shop, customer };
}
