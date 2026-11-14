import { coverUrl } from "./catalog.js";
import { productAsPhoto } from "./productPhotos.js";

/** "Popular right now" searches; only the ones that match products in stock are shown. */
export const POPULAR_QUERIES = [
  "iphone 18 pro max",
  "iphone duo",
  "iphone 17",
  "samsung galaxy",
  "z fold",
  "google pixel",
  "macbook",
  "airpods",
  "apple watch",
  "jbl speaker",
  "ipad",
  "charger"
];

const SYNONYMS = {
  phone: ["phones", "iphone", "smartphone", "mobile"],
  samsung: ["galaxy"],
  fold: ["foldable", "flip"],
  pixel: ["google"],
  mac: ["macbook", "laptop", "laptops"],
  tablet: ["ipad", "tablets"],
  watch: ["watches", "smartwatch"],
  earbuds: ["airpods", "earphones", "headphones", "buds"],
  speaker: ["speakers", "jbl", "partybox", "boombox", "soundbar"],
  charger: ["chargers", "adapter", "charging", "cable", "power bank", "powerbank"],
  case: ["cases", "cover", "covers"],
  protector: ["screen protector", "tempered glass", "glass"]
};

function expandToken(token) {
  const set = new Set([token]);
  for (const [key, list] of Object.entries(SYNONYMS)) {
    if (token === key || list.includes(token)) {
      set.add(key);
      list.forEach((w) => set.add(w));
    }
  }
  return [...set];
}

/** Admin photo names (e.g. "Red Versace T shirt"), index-aligned with `images`. */
function photoNames(product) {
  return Array.isArray(product.imageNames)
    ? product.imageNames.map((n) => (typeof n === "string" ? n.trim() : ""))
    : [];
}

function productHaystack(product) {
  const groups = Array.isArray(product.groups) ? product.groups.join(" ") : "";
  const sizes = Array.isArray(product.sizes) ? product.sizes.join(" ") : "";
  const colors = Array.isArray(product.colors) ? product.colors.join(" ") : "";
  const names = photoNames(product).join(" ");
  return `${product.name || ""} ${product.category || ""} ${product.description || ""} ${groups} ${sizes} ${colors} ${names}`.toLowerCase();
}

function textMatchesQuery(text, q) {
  const hay = text.toLowerCase();
  if (hay.includes(q)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => {
    const variants = expandToken(token);
    return variants.some((v) => hay.includes(v));
  });
}

export function productMatchesQuery(product, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return textMatchesQuery(productHaystack(product), q);
}

/** First named photo matching the query → { name, url, index }, or null. */
function matchingPhoto(product, q) {
  const names = photoNames(product);
  const images = Array.isArray(product.images) ? product.images : [];
  for (let i = 0; i < names.length; i++) {
    if (names[i] && textMatchesQuery(names[i], q)) {
      return { name: names[i], url: typeof images[i] === "string" ? images[i] : "", index: i };
    }
  }
  return null;
}

/**
 * Index of the photo whose name the query matches better than the product name, or -1.
 * Used so search results show e.g. "China Black timberland" with the black photo.
 */
export function matchedPhotoIndex(product, query) {
  const q = query.trim().toLowerCase();
  if (!q) return -1;
  const names = photoNames(product);
  // Exact photo name wins even when the product name also matches ("Black Timberland").
  const exact = names.findIndex((n) => n && n.toLowerCase() === q);
  if (exact >= 0) return exact;
  if (textMatchesQuery(product.name || "", q)) return -1;
  const photo = matchingPhoto(product, q);
  return photo ? photo.index : -1;
}

export function countMatchingProducts(products, query) {
  const q = query.trim();
  if (!q) return products.length;
  return products.filter((p) => productMatchesQuery(p, q)).length;
}

/** Temu-style typeahead rows */
export function buildSuggestions(query, products, limit = 10) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return products.slice(0, limit).map((p) => ({
      kind: "popular",
      label: p.name,
      product: p,
      thumb: coverUrl(p)
    }));
  }

  const matches = products
    .filter((p) => productMatchesQuery(p, q))
    .slice(0, limit);

  return matches.map((p) => {
    // Show the matched photo and its name when the query is about that photo.
    const pi = matchedPhotoIndex(p, q);
    const photo =
      pi >= 0
        ? { name: photoNames(p)[pi], url: Array.isArray(p.images) ? p.images[pi] : "" }
        : null;
    const label = photo ? photo.name : p.name;
    const lower = (label || "").toLowerCase();
    const idx = lower.indexOf(q);
    let before = label;
    let bold = "";
    let after = "";
    if (idx >= 0) {
      before = label.slice(0, idx);
      bold = label.slice(idx, idx + q.length);
      after = label.slice(idx + q.length);
    }
    return {
      kind: "match",
      label,
      before,
      bold,
      after,
      product: pi >= 0 ? productAsPhoto(p, pi) : p,
      thumb: (photo && photo.url) || coverUrl(p)
    };
  });
}

/** Up to 8 popular searches that actually find something, each with a product photo. */
export function popularChips(products) {
  const out = [];
  for (const q of POPULAR_QUERIES) {
    // Only suggest searches a product NAME matches (descriptions mention other models),
    // and use that product's photo.
    const p = products.find((x) => textMatchesQuery(`${x.name || ""} ${x.category || ""}`, q));
    if (p) out.push({ query: q, product: p, thumb: coverUrl(p) });
    if (out.length >= 8) break;
  }
  return out;
}
