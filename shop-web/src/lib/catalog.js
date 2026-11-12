import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { categoryKeysFromSettings, imageMapFromSettings, loadCategoryOrder, sortByOrder } from "./categoryImages.js";
import {
  enrichProduct,
  resolveCoverUrl,
  resolveProductImages,
  galleryImagesForProduct,
  stockPhotoForProduct
} from "./productPhotos.js";
import { sortProductsNewestFirst } from "./shopBrowse.js";
import { globalDeliveryFee } from "./deliveryFees.js";

const DEFAULT_CATEGORIES = ["iPhones", "Samsung", "Google Pixel", "MacBooks", "iPads", "Apple Watch", "AirPods & Audio", "Accessories"];

/**
 * Sample catalog for local development only (shown when Firestore has no products).
 * Pixel prices are from the Bagz December flyer; iPhone prices are placeholders.
 */
function demoProducts() {
  const items = [
    ["iPhones", "iPhone 18 Pro Max 512GB", 0, 0],
    ["iPhones", "iPhone 18 Pro 256GB", 0, 0],
    ["iPhones", "iPhone Duo", 0, 0],
    ["iPhones", "iPhone 17 Pro Max 256GB", 0, 0],
    ["iPhones", "iPhone 17 Pro 256GB", 0, 0],
    ["iPhones", "iPhone 17 256GB", 0, 0],
    ["iPhones", "iPhone Air 256GB", 0, 0],
    ["Google Pixel", "Pixel 10 Pro XL 512GB", 4800000, 0],
    ["Google Pixel", "Pixel 10 Pro XL 256GB", 3900000, 0],
    ["Google Pixel", "Pixel 9 Pro Fold 512GB", 4000000, 0],
    ["Google Pixel", "Pixel 10 Pro 256GB", 3800000, 0],
    ["Google Pixel", "Pixel 9 Pro XL 512GB", 3200000, 0],
    ["Google Pixel", "Pixel 9 Pro XL 256GB", 3000000, 0],
    ["Google Pixel", "Pixel 9 Pro 256GB", 2700000, 0],
    ["Accessories", "USB-C charging cable", 0, 0],
    ["Samsung", "Samsung Galaxy Z Fold8 512GB", 0, 0]
  ];
  return items.map(([category, name, price, offer], i) => {
    const id = `demo-${i + 1}`;
    const base = { id, name, category, price, offerPercentage: offer };
    return enrichProduct(base);
  });
}

/** Demo items only in `npm run dev` — production shows the real (possibly empty) catalog. */
const fallbackProducts = () => (import.meta.env.DEV ? demoProducts() : []);

export async function loadCategories() {
  try {
    const snap = await getDoc(doc(db, "settings", "categories"));
    if (!snap.exists()) return DEFAULT_CATEGORIES;
    const keys = sortByOrder(categoryKeysFromSettings(snap.data()), await loadCategoryOrder());
    return keys.length ? keys : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function loadCategoryImageMap() {
  try {
    const snap = await getDoc(doc(db, "settings", "categories"));
    if (!snap.exists()) return {};
    return imageMapFromSettings(snap.data());
  } catch {
    return {};
  }
}

export async function loadProducts() {
  try {
    const snap = await getDocs(collection(db, "product"));
    const list = sortProductsNewestFirst(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        // Admin "Hidden from shop" (also set on imported products that still need a photo).
        .filter((p) => p.hidden !== true)
        .map((p) => enrichProduct(p))
    );
    return list.length ? list : fallbackProducts();
  } catch {
    return fallbackProducts();
  }
}

export function formatUgx(amount) {
  const n = Math.round(Number(amount) || 0);
  return `UGX ${n.toLocaleString("en-UG")}`;
}

export function priceParts(product) {
  const price = Number(product.price) || 0;
  const offerPct = Number(product.offerPercentage ?? product.offer) || 0;
  const now = Date.now();
  const start = product.saleStartAt;
  const end = product.saleEndAt;

  if (offerPct <= 0) {
    return { current: price, old: null, discount: null, salePending: false };
  }
  if (start != null && now < start) {
    const previewCurrent = price * (1 - offerPct / 100);
    return {
      current: price,
      old: null,
      displayNow: previewCurrent,
      displayOld: price,
      discount: null,
      salePending: true,
      pendingPercent: offerPct
    };
  }
  if (end != null && now >= end) {
    return { current: price, old: null, discount: null, salePending: false };
  }

  const current = price * (1 - offerPct / 100);
  return {
    current,
    old: price,
    discount: `-${Math.round(offerPct)}%`,
    salePending: false
  };
}

/** Delivery fee for a product (global admin fees; per-product free shipping still applies). */
export function productDeliveryFee(product, zone = "kampala") {
  if (product?.freeShipping) return 0;
  return globalDeliveryFee(zone);
}

/** Jumia-style shipping line — fees from Admin → Delivery fees (same for all products). */
export function productShippingSnippet(product) {
  if (product?.freeShipping) {
    return "+ Free shipping on this item";
  }
  const kampala = productDeliveryFee(product, "kampala");
  const outside = productDeliveryFee(product, "outside");
  if (kampala === null && outside === null) return null;
  if (kampala != null && outside != null) {
    return `+ shipping from ${formatUgx(kampala)} within Kampala · ${formatUgx(outside)} outside Kampala`;
  }
  if (kampala != null) {
    return `+ shipping from ${formatUgx(kampala)} within Kampala`;
  }
  return `+ shipping from ${formatUgx(outside)} outside Kampala`;
}

function intArgbToHex(n) {
  const hex = (n >>> 0).toString(16).padStart(8, "0").slice(-6);
  return `#${hex.toUpperCase()}`;
}

const HEX_COLOR_NAMES = {
  "#000000": "Black",
  "#FFFFFF": "White",
  "#FF0000": "Red",
  "#008000": "Green",
  "#0000FF": "Blue",
  "#FFFF00": "Yellow",
  "#FFA500": "Orange",
  "#800080": "Purple",
  "#FFC0CB": "Pink",
  "#A52A2A": "Brown",
  "#808080": "Gray",
  "#000080": "Navy",
  "#008080": "Teal",
  "#C0C0C0": "Silver",
  "#FFD700": "Gold",
  "#F5F5DC": "Beige",
  "#800020": "Burgundy"
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function nearestColorLabel(hex) {
  const key = hex.startsWith("#") ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
  if (HEX_COLOR_NAMES[key]) return HEX_COLOR_NAMES[key];
  const rgb = hexToRgb(key);
  let best = "Custom";
  let bestD = Infinity;
  for (const h of Object.keys(HEX_COLOR_NAMES)) {
    const d =
      (rgb[0] - hexToRgb(h)[0]) ** 2 +
      (rgb[1] - hexToRgb(h)[1]) ** 2 +
      (rgb[2] - hexToRgb(h)[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = HEX_COLOR_NAMES[h];
    }
  }
  return best;
}

/** Human label for cart/orders (hex → name when known). */
export function colorLabelFromValue(displayValue) {
  if (!displayValue) return "";
  const t = String(displayValue).trim();
  if (t.startsWith("#")) {
    const key = t.toUpperCase();
    return HEX_COLOR_NAMES[key] || nearestColorLabel(key);
  }
  return t;
}

/** Admin stores colors as ARGB ints or hex/name strings — normalize for the shop UI. */
export function colorToDisplay(c) {
  if (c == null) return "";
  if (typeof c === "number" && Number.isFinite(c)) return intArgbToHex(c);
  if (typeof c === "string") {
    const t = c.trim();
    if (!t) return "";
    if (t.startsWith("#")) return t;
    if (/^-?\d+$/.test(t)) return intArgbToHex(parseInt(t, 10));
    return t;
  }
  return String(c);
}

export function colorIsHex(label) {
  return typeof label === "string" && /^#[0-9A-Fa-f]{6}$/.test(label);
}

export function coverUrl(product) {
  return resolveCoverUrl(product);
}

export {
  stockPhotoForProduct,
  stockPhotoForCategory,
  galleryImagesForProduct
} from "./productPhotos.js";

/**
 * Sold count — only from real data (product.soldCount, e.g. maintained by order processing).
 * Returns "" when unknown: invented "sold" numbers would mislead customers.
 */
export function soldLabel(product) {
  const n = Math.floor(Number(product?.soldCount) || 0);
  if (n <= 0) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K+ sold`;
  return `${n} sold`;
}

export function ratingLabel(product) {
  const count = Number(product.reviewsCount) || 0;
  const r = Number(product.rating);
  if (count > 0 && r > 0) return r.toFixed(1);
  return "";
}

export function reviewCount(product) {
  const n = Number(product.reviewsCount);
  return n > 0 ? n : 0;
}

/** Units on hand from admin (Firestore `stock` field). */
export function productStock(product) {
  const n = Number(product?.stock);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function stockLabel(product) {
  const n = productStock(product);
  if (n <= 0) return "Out of stock";
  return `${n.toLocaleString("en-UG")} pcs in stock`;
}

export function productImages(product) {
  return resolveProductImages(product);
}

export function defaultSizes(product) {
  if (Array.isArray(product.sizes) && product.sizes.length) return product.sizes;
  const cat = (product.category || "").toLowerCase();
  if (cat.includes("shoe")) return ["38", "39", "40", "41", "42"];
  if (cat.includes("cloth")) return ["S", "M", "L", "XL"];
  return ["One size"];
}

/** Sizes the admin typed on the product. Empty when the admin left sizes blank. */
export function adminSizes(product) {
  if (!Array.isArray(product?.sizes)) return [];
  return product.sizes.map((s) => String(s).trim()).filter(Boolean);
}

/** A size choice is required only when the admin saved more than one size. */
export function productNeedsSize(product) {
  return adminSizes(product).length > 1;
}

/** @deprecated Prefer productColorChoices(); no fake defaults when admin omitted colors. */
export function defaultColors(product) {
  if (Array.isArray(product.colors) && product.colors.length) {
    return product.colors.map(colorToDisplay).filter(Boolean);
  }
  return [];
}

export function urgencyLabel(product) {
  const n = productStock(product);
  if (n <= 0) return "Out of stock";
  if (n <= 5) return "Only few left";
  if (n <= 20) return "Almost sold out";
  return null;
}
