import { doc, getDoc } from "firebase/firestore/lite";
import { db } from "./firebase.js";
import { SUPPORT_EMAIL } from "./shopContact.js";

import { BRAND as BRAND_INFO } from "./brand.js";
import { siteGraph, productGraph, categoryGraph } from "./seoSchema.js";
import { categoryPath, productPath, productSeoTitle } from "./seoPaths.js";

const BRAND = BRAND_INFO.name;
const SITE_NAME = BRAND_INFO.shortName;

const DEFAULT = {
  title: `${BRAND} | Authentic iPhones, Apple & Tech in Kampala`,
  description: BRAND_INFO.description,
  keywords: [
    "Bagz Apple Services",
    "Bagz Uganda",
    "iPhone price in Uganda",
    "buy iPhone Kampala",
    "iPhone 18 Pro Uganda",
    "Google Pixel Uganda",
    "Samsung Z Fold Uganda",
    "MacBook Kampala",
    "Apple Watch Uganda",
    "AirPods Kampala",
    "phone swap Kampala",
    "iPhone repair Kampala",
    "authentic Apple store Uganda",
    "phone accessories Kampala",
    "mobile money phone shop Uganda"
  ].join(", ")
};

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || BRAND_INFO.siteUrl).replace(/\/$/, "");
const DEFAULT_OG_IMAGE = BRAND_INFO.ogImage;

export const SHOP_SEO_PAGES = {
  home: {
    label: "Home",
    path: "/",
    title: "Bagz Apple Services | Authentic iPhones & Samsung in Kampala",
    description: "Buy brand-new and certified iPhones, Google Pixel, Samsung Galaxy, MacBooks, Apple Watch and accessories at Bagz Apple Services, Kampala. Swap & top-up, warranty, same-day delivery.",
    keywords: "Bagz Apple Services, iPhone price Uganda, buy iPhone Kampala, Google Pixel Uganda, Samsung Uganda, Apple accessories Kampala, phone swap Uganda"
  },
  newIn: {
    label: "New in",
    path: "/",
    title: "New Arrivals | Latest iPhones & Gadgets in Uganda | Bagz",
    description: "The newest phones and gadgets at Bagz Apple Services — latest iPhone, Pixel and Samsung models, priced in UGX with same-day delivery in Kampala.",
    keywords: "new iPhone Uganda, latest phones Kampala, new arrivals Bagz, iPhone 18 Pro price Uganda"
  },
  categories: {
    label: "Categories",
    path: "/",
    title: "Shop by Category | iPhone, Pixel, Samsung, MacBook, Watch | Bagz",
    description: "Browse Bagz categories: iPhones, Google Pixel, Samsung Galaxy & Z series, MacBooks, iPads, Apple Watch, AirPods, audio and accessories. Order online in Uganda.",
    keywords: "iPhones Uganda, Google Pixel Kampala, Samsung Z Fold Uganda, MacBook Uganda, Apple Watch Kampala, phone accessories Uganda"
  },
  search: {
    label: "Search",
    path: "/",
    title: "Search Phones & Gadgets | Bagz Apple Services",
    description: "Search Bagz for iPhones, Pixel, Samsung, MacBooks, watches and accessories. Find your device and pay with MTN or Airtel Money.",
    keywords: "search iPhone Uganda, find phone Kampala, Bagz search"
  },
  cart: {
    label: "Cart",
    path: "/",
    title: "Your Cart | Bagz Apple Services",
    description: "Review the items in your Bagz cart, check the UGX total and delivery, then continue to checkout.",
    keywords: "Bagz cart, buy phone online Kampala"
  },
  checkout: {
    label: "Checkout",
    path: "/",
    title: "Secure Checkout | MTN & Airtel Money | Bagz Apple Services",
    description: "Pay for your Bagz order with MTN Mobile Money, Airtel Money or card. Same-day delivery in Kampala, prices in UGX.",
    keywords: "mobile money phone checkout Uganda, Bagz checkout"
  },
  orders: {
    label: "My orders",
    path: "/",
    title: "Track Your Order | Bagz Apple Services",
    description: "See your Bagz orders, payment status and delivery updates.",
    keywords: "track order Bagz, delivery status Kampala"
  },
  support: {
    label: "Support",
    path: "/help/support",
    title: "Help, Warranty & Support | Bagz Apple Services",
    description: "Get help with a Bagz order, warranty claim, swap or repair. Call or WhatsApp Bagz Apple Services, Kampala.",
    keywords: "Bagz support, iPhone warranty Kampala, phone repair Kampala, Bagz WhatsApp"
  }
};

let seoOverride = null;

export function setSeoOverride(data) {
  seoOverride = data && typeof data === "object" ? data : null;
}

export async function loadSeoSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "seo"));
    if (snap.exists()) setSeoOverride(snap.data());
  } catch {
    /* keep built-in titles */
  }
  return seoOverride;
}

function pageCopy(key) {
  const page = seoOverride?.pages?.[key] || {};
  const site = seoOverride?.site || {};
  const builtIn = SHOP_SEO_PAGES[key] || SHOP_SEO_PAGES.home;
  return {
    title: (page.title || (key === "home" ? site.title : "") || builtIn.title || DEFAULT.title).trim(),
    description: (page.description || (key === "home" ? site.description : "") || builtIn.description || DEFAULT.description).trim(),
    keywords: (page.keywords || (key === "home" ? site.keywords : "") || builtIn.keywords || DEFAULT.keywords).trim()
  };
}

function origin() {
  return SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
}

function absUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${origin()}${path.startsWith("/") ? path : `/${path}`}`;
}

function setMeta(attr, key, value) {
  if (!value) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel, href, extra = {}) {
  if (!href) return;
  const selector = extra.sizes
    ? `link[rel="${rel}"][sizes="${extra.sizes}"]`
    : `link[rel="${rel}"]`;
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (extra.sizes) el.setAttribute("sizes", extra.sizes);
    if (extra.type) el.setAttribute("type", extra.type);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function applySocialMeta({ title, description, url, image, type = "website" }) {
  const ogImage = absUrl(image || DEFAULT_OG_IMAGE);
  const pageUrl = url || absUrl("/");
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("property", "og:locale", "en_UG");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:type", type);
  setMeta("property", "og:url", pageUrl);
  if (ogImage) setMeta("property", "og:image", ogImage);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  if (ogImage) setMeta("name", "twitter:image", ogImage);
}

function applySiteJsonLd() {
  setJsonLd("site-jsonld", siteGraph(origin()));
}

export function productCanonicalPath(product) {
  return productPath(product);
}

export function productPublicUrl(product) {
  return absUrl(productCanonicalPath(product));
}

export function applyShopPage(key) {
  const copy = pageCopy(key || "home");
  const path = SHOP_SEO_PAGES[key]?.path || "/";
  document.title = copy.title.slice(0, 70);
  setMeta("name", "description", copy.description.slice(0, 160));
  setMeta("name", "keywords", copy.keywords);
  setMeta("name", "robots", "index, follow");
  setMeta("name", "author", BRAND);
  setMeta("name", "geo.region", "UG");
  setMeta("name", "geo.placename", "Uganda");
  setLink("canonical", absUrl(path));
  applySocialMeta({
    title: copy.title,
    description: copy.description,
    url: absUrl(path)
  });
  applySiteJsonLd();
  setJsonLd("product-jsonld", null);
}

export function applyDefaultSeo() {
  applyShopPage("home");
}

/** Help page. `path` is its clean address (/help/<id>), so variants never become their own canonical. */
export function applySupportSeo(page, path) {
  if (!page) {
    applyDefaultSeo();
    return;
  }
  const title = page.title.includes(BRAND) ? page.title : `${page.title} | ${BRAND}`;
  const description = (page.description || page.title).slice(0, 160);
  document.title = title.slice(0, 70);
  setMeta("name", "description", description);
  setMeta("name", "keywords", `${page.title}, ${BRAND}, Uganda online shopping`);
  const url = absUrl(path || window.location?.pathname || "/");
  setLink("canonical", url);
  applySocialMeta({ title, description, url });
  applySiteJsonLd();
  setJsonLd("product-jsonld", null);
}

export function applyProductSeo(product, formatUgx, priceParts, coverUrl) {
  if (!product) {
    applyDefaultSeo();
    return;
  }
  const prices = priceParts(product);
  const title =
    product.seoTitle && product.seoTitle.length <= 65 ? product.seoTitle : productSeoTitle(product.name, BRAND);
  const description =
    product.seoDescription ||
    product.description ||
    `Buy ${product.name} in Kampala at Bagz Apple Services. 100% authentic, warranty, same-day delivery and mobile money payment. Price in UGX.`;
  const keywords =
    product.seoKeywords ||
    `${product.name}, ${product.category}, buy ${product.name} Uganda, Bagz`;
  const url = productPublicUrl(product);
  const image = coverUrl(product) || product.cardImage || product.images?.[0];

  document.title = title.slice(0, 70);
  setMeta("name", "description", description.slice(0, 160));
  setMeta("name", "keywords", keywords);
  setLink("canonical", url);
  applySocialMeta({
    title,
    description,
    url,
    image,
    type: "product"
  });
  applySiteJsonLd();

  setJsonLd(
    "product-jsonld",
    productGraph(origin(), product, {
      price: prices.current,
      image: image ? absUrl(image) : "",
      images: (product.images || []).filter(Boolean).slice(0, 6).map((u) => absUrl(u)),
      description
    })
  );
}

/** Category landing page (/c/<slug>). */
export function applyCategorySeo(category, products = []) {
  if (!category || category === "All") {
    applyDefaultSeo();
    return;
  }
  const count = products.length;
  const title = `${category} Price in Uganda | Buy ${category} in Kampala | ${BRAND}`;
  const description =
    `Shop ${count ? count + " " : ""}authentic ${category} at ${BRAND}, Kampala. ` +
    `Best prices in UGX, warranty, same-day delivery in Kampala and mobile money payment.`;
  const url = absUrl(categoryPath(category));
  document.title = title.slice(0, 70);
  setMeta("name", "description", description.slice(0, 160));
  setMeta("name", "keywords", `${category} price in Uganda, buy ${category} Kampala, ${category} Uganda, ${BRAND}`);
  setLink("canonical", url);
  applySocialMeta({ title, description, url });
  applySiteJsonLd();
  setJsonLd("product-jsonld", categoryGraph(origin(), category, products));
}

