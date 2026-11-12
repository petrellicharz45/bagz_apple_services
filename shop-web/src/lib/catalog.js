import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { categoryKeysFromSettings, imageMapFromSettings } from "./categoryImages.js";
import {
  enrichProduct,
  resolveCoverUrl,
  resolveProductImages,
  galleryImagesForProduct,
  stockPhotoForProduct
} from "./productPhotos.js";
import { sortProductsNewestFirst } from "./shopBrowse.js";
import { globalDeliveryFee } from "./deliveryFees.js";

const DEFAULT_CATEGORIES = [
  "Clothing",
  "Shoes",
  "Accessories",
  "Bags",
  "Jewelry",
  "Beauty"
];

function demoProducts() {
  const items = [
    ["Clothing", "Women's cotton dress", 45000, 22],
    ["Clothing", "Men's casual shirt", 38000, 18],
    ["Shoes", "Running sneakers", 89000, 25],
    ["Shoes", "Leather sandals", 52000, 15],
    ["Accessories", "Smart watch band", 15000, 30],
    ["Accessories", "Sunglasses UV400", 22000, 20],
    ["Bags", "Crossbody handbag", 65000, 28],
    ["Bags", "Travel backpack 25L", 78000, 24],
    ["Jewelry", "Gold-tone necklace", 28000, 12],
    ["Jewelry", "Hoop earrings set", 18000, 16],
    ["Beauty", "Skincare gift set", 42000, 35],
    ["Beauty", "Hair styling kit", 35000, 19],
    ["Clothing", "Kids hoodie", 32000, 14],
    ["Accessories", "Phone case bundle", 12000, 40],
    ["Bags", "Laptop sleeve", 24000, 10],
    ["Shoes", "Canvas slip-ons", 41000, 21],
    ["Clothing", "Linen summer dress", 48000, 17],
    ["Beauty", "Vitamin C serum", 29000, 22],
    ["Accessories", "Leather belt classic", 19000, 11],
    ["Bags", "Mini shoulder bag", 44000, 26],
    ["Jewelry", "Silver bracelet", 32000, 14],
    ["Shoes", "Sport slides", 27000, 19],
    ["Clothing", "Polo shirt pack", 36000, 16],
    ["Accessories", "Wireless earbuds case", 14000, 24],
    ["Beauty", "Lip gloss set", 16000, 28],
    ["Bags", "Gym duffel", 55000, 20],
    ["Jewelry", "Pearl stud earrings", 24000, 13],
    ["Clothing", "Jogger pants", 39000, 18],
    ["Accessories", "Cap adjustable", 17000, 15],
    ["Shoes", "Formal loafers", 72000, 23],
    ["Beauty", "Face mask 10-pack", 21000, 31]
  ];
  return items.map(([category, name, price, offer], i) => {
    const id = `demo-${i + 1}`;
    const base = { id, name, category, price, offerPercentage: offer };
    return enrichProduct(base);
  });
}

export async function loadCategories() {
  try {
    const snap = await getDoc(doc(db, "settings", "categories"));
    if (!snap.exists()) return DEFAULT_CATEGORIES;
    const keys = categoryKeysFromSettings(snap.data());
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
      snap.docs.map((d) => enrichProduct({ id: d.id, ...d.data() }))
    );
    return list.length ? list : demoProducts();
  } catch {
    return demoProducts();
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

/** Stable pseudo sold count for Temu-style social proof (until real analytics exist). */
export function soldLabel(product) {
  const seed = String(product.id || product.name || "")
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = 120 + (seed % 9800);
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K+ sold`;
  return `${n}+ sold`;
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
