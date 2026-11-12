/** Share links for product detail pages. */

import { SUPPORT_EMAIL } from "./shopContact.js";

function siteOrigin() {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().startsWith("http")) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://fancydealsug.com";
}

export function productPageUrl(product) {
  if (!product) return siteOrigin();
  const slug = product.slug || product.id;
  return `${siteOrigin()}/p/${encodeURIComponent(slug)}`;
}

export function productShareLinks(product) {
  const pageUrl = productPageUrl(product);
  const title = (product?.name || "Product").trim();
  const message = `${title} — Fancy Deals Uganda`;
  const encUrl = encodeURIComponent(pageUrl);
  const encText = encodeURIComponent(message);
  return {
    pageUrl,
    whatsapp: `https://wa.me/?text=${encText}%20${encUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encText}`
  };
}

export function reportProductMailto(product) {
  const pageUrl = productPageUrl(product);
  const name = (product?.name || "Product").trim();
  const subject = encodeURIComponent(`Report incorrect product: ${name}`);
  const body = encodeURIComponent(
    `Hi Fancy Deals,\n\nI would like to report incorrect information on this product:\n\n${name}\n${pageUrl}\n\nDetails:\n`
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
