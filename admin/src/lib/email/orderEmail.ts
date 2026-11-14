import { env } from "$env/dynamic/public";
import { BRAND } from "$lib/brand";
// Same template parameters as the shop (one EmailJS template for every order email).
import { orderEmailParams, sendEmailJs, emailJsConfigured } from "../../../../shared/orderEmail.js";

const EMAILJS = {
  serviceId: (env.PUBLIC_EMAILJS_SERVICE_ID || "").trim(),
  templateId: (env.PUBLIC_EMAILJS_TEMPLATE_ID || "").trim(),
  publicKey: (env.PUBLIC_EMAILJS_PUBLIC_KEY || "").trim()
};

const BRAND_INFO = {
  name: BRAND.name,
  phone: "+256 754 558 186",
  whatsapp: "256754558186",
  email: "info@bagzappleservices.com",
  // Google Business Profile review link (also in shop-web/src/lib/brand.js)
  reviewUrl: "https://g.page/r/CUu9l9fAOZMsEBM/review"
};

export const customerEmailEnabled = emailJsConfigured(EMAILJS);

function money(n: unknown) {
  return Math.round(Number(n) || 0);
}

function orderDate(o: any): string {
  const v = o.timestamp || o.createdAt;
  const d = v?.seconds ? new Date(v.seconds * 1000) : v ? new Date(v) : null;
  return d && !isNaN(d.getTime())
    ? d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : o.date || "";
}

/** Firestore `order` document → common email shape (shared/orderEmail.js). */
function normalise(o: any) {
  const products: any[] = Array.isArray(o.products) ? o.products : [];
  return {
    ref: o.id,
    date: orderDate(o),
    name: o.customerName || o.address?.label || "",
    email: o.customerEmail || "",
    phone: o.customerPhone || o.address?.phone || "",
    address: o.address?.address || [o.address?.street, o.address?.city].filter(Boolean).join(", "),
    note: o.note || "",
    total: money(o.totalPrice),
    paymentLabel:
      o.paymentStatus === "paid" || o.paymentStatus === "Paid"
        ? "Paid"
        : o.paymentStatus === "cash_on_delivery"
          ? "Cash on delivery"
          : String(o.paymentMethod || o.paymentStatus || ""),
    items: products.map((p) => ({
      name: p.product?.name || "",
      qty: p.quantity || 1,
      price: money(p.product?.price),
      image: Array.isArray(p.product?.images) ? p.product.images[0] : "",
      option: [p.selectedColorName, p.selectedSize]
        .filter((x: unknown) => x && x !== "Default" && x !== "One size")
        .join(" · ")
    }))
  };
}

/**
 * Emails the customer about an order update. `kind`: "Confirmed" | "Shipped" | "Delivered" |
 * "Canceled" | "paid". Resolves "sent", "no-email" (order has no customer email),
 * "off" (EmailJS not set up) or "failed".
 */
export async function emailCustomerUpdate(order: any, kind: string): Promise<"sent" | "no-email" | "off" | "failed"> {
  if (!customerEmailEnabled) return "off";
  const o = normalise(order);
  if (!o.email) return "no-email";
  const ok = await sendEmailJs(EMAILJS, orderEmailParams(kind, o, { toEmail: o.email, toName: o.name, brand: BRAND_INFO }));
  return ok ? "sent" : "failed";
}
