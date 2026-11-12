/**
 * Public URL paths shared by the shop app and the build-time SEO prerender
 * (scripts/prerender-seo.mjs). No browser or Firebase imports here.
 */

/** "AirPods & Audio" → "airpods-audio" */
export function categorySlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryPath(name) {
  const slug = categorySlug(name);
  return slug ? `/c/${slug}` : "/";
}

/** Category name for a /c/<slug> path, matched against the shop's category list. */
export function categoryFromPath(pathname, categories = []) {
  const m = String(pathname || "").match(/^\/c\/([^/?#]+)\/?$/);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase();
  return categories.find((c) => categorySlug(c) === slug) || null;
}

export function productPath(product) {
  const slug = product?.slug || product?.id;
  return slug ? `/p/${slug}` : "/";
}

/** Device maker for structured data (the shop name is not the brand of an iPhone). */
export function productBrand(name = "") {
  const n = String(name).toLowerCase();
  if (/iphone|ipad|macbook|apple|airpods|\bimac\b/.test(n)) return "Apple";
  if (/samsung|galaxy/.test(n)) return "Samsung";
  if (/pixel|google/.test(n)) return "Google";
  if (/\bjbl\b|partybox|boombox/.test(n)) return "JBL";
  if (/\bsony\b/.test(n)) return "Sony";
  if (/green lion/.test(n)) return "Green Lion";
  if (/harman/.test(n)) return "Harman Kardon";
  if (/\bbose\b/.test(n)) return "Bose";
  if (/anker|soundcore/.test(n)) return "Anker";
  return "";
}

/** Product page title that fits Google's ~65 characters: longest variant that fits wins. */
export function productSeoTitle(name, brandName = "Bagz Apple Services") {
  const n = String(name || "").trim();
  const options = [
    `${n} Price in Uganda | ${brandName}`,
    `${n} Price in Uganda | Bagz`,
    `${n} | Bagz Uganda`,
    `${n} | Bagz`
  ];
  return options.find((t) => t.length <= 65) || n;
}
