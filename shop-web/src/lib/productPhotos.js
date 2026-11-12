/**
 * Fallback photos used when a product has no/broken image URL.
 * Bagz: local brand images first (shop-web/public/brand), Unsplash only where we have no own photo.
 */
const U = (id, w = 600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${w}&q=80`;
const P = (file) => `/brand/products/${file}`;
const S = (file) => `/brand/store/${file}`;

const STOCK = {
  iphone18ProMax: P("iphone18-promax-512.jpg"),
  iphone18Pro: P("iphone18-pro.jpg"),
  iphoneDuo: P("iphone-duo-star-white-front-back.jpg"),
  iphone17ProMax: P("iphone17promx.jpg"),
  iphone17Pro: P("1.jpg"),
  iphone17: P("iphone17-1.jpg"),
  iphoneAir: P("air2.jpg"),
  iphone: P("apple-iphone-18-pro-max-silver.jpg"),
  cable: P("4.jpg"),
  watch: U("photo-1523275335684-37898b6baf30"),
  store: S("bagz-store.jpg"),
  general: S("bagz-store.jpg")
};

const CATEGORY_STOCK = {
  iphone: STOCK.iphone,
  watch: STOCK.watch,
  accessor: STOCK.store,
  pixel: STOCK.store,
  samsung: STOCK.store,
  macbook: STOCK.store,
  audio: STOCK.store
};

/** Resize Unsplash URLs; local images are returned as-is. */
function sized(url, size) {
  if (size === 600 || !url.includes("images.unsplash.com")) return url;
  return url.replace("w=600", `w=${size}`).replace("h=600", `h=${size}`);
}

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  const t = url.trim();
  if (!t) return "";
  if (t.startsWith("blob:") || t.startsWith("data:")) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return "";
}

/**
 * Gallery order for PDP + color chips — matches Admin upload list (`images[]` only).
 * Card/cover image is separate and must not shift colorImageIndices.
 */
export function adminGalleryUrls(product) {
  const out = [];
  const push = (u) => {
    const n = normalizeUrl(u);
    if (n && !out.includes(n)) out.push(n);
  };
  const raw = product?.images;
  if (Array.isArray(raw)) {
    for (const u of raw) push(u);
  } else if (typeof raw === "string") {
    push(raw);
  }
  if (!out.length) {
    push(product?.cardImage);
    push(product?.imageUrl);
    push(product?.image);
  }
  return out;
}

/** All known URLs (card first) — for search/legacy fallbacks. */
export function collectProductImageUrls(product) {
  const out = [];
  const push = (u) => {
    const n = normalizeUrl(u);
    if (n && !out.includes(n)) out.push(n);
  };
  push(product?.cardImage);
  for (const u of adminGalleryUrls(product)) push(u);
  return out;
}

/** Best matching stock photo from product name + category. */
export function stockPhotoForProduct(product, size = 600) {
  const name = `${product?.name || ""}`.toLowerCase();
  const cat = `${product?.category || ""}`.toLowerCase();

  const rules = [
    [/iphone 18 pro max/, STOCK.iphone18ProMax],
    [/iphone 18 pro/, STOCK.iphone18Pro],
    [/iphone duo/, STOCK.iphoneDuo],
    [/iphone 17 pro max/, STOCK.iphone17ProMax],
    [/iphone 17 pro/, STOCK.iphone17Pro],
    [/iphone air/, STOCK.iphoneAir],
    [/iphone 17/, STOCK.iphone17],
    [/iphone/, STOCK.iphone],
    [/cable|charger|usb-c|lightning/, STOCK.cable],
    [/watch/, STOCK.watch]
  ];

  for (const [re, url] of rules) {
    if (re.test(name)) return sized(url, size);
  }

  for (const [key, url] of Object.entries(CATEGORY_STOCK)) {
    if (cat.includes(key)) return sized(url, size);
  }

  return sized(STOCK.general, size);
}

export function stockPhotoForCategory(category, size = 320) {
  const cat = `${category || ""}`.toLowerCase();
  for (const [key, url] of Object.entries(CATEGORY_STOCK)) {
    if (cat.includes(key)) return sized(url, size);
  }
  return stockPhotoForProduct({ name: category, category }, size);
}

/** Primary display URL: real upload first, else relevant stock art. */
export function resolveCoverUrl(product) {
  const card = normalizeUrl(product?.cardImage);
  if (card) return card;
  const gallery = adminGalleryUrls(product);
  if (gallery.length) return gallery[0];
  return stockPhotoForProduct(product);
}

export function resolveProductImages(product) {
  const gallery = adminGalleryUrls(product);
  if (gallery.length) return gallery;
  return [stockPhotoForProduct(product)];
}

/** PDP gallery — same order as Admin → Colors → photo mapping. */
export function galleryImagesForProduct(product, max = 12) {
  const urls = adminGalleryUrls(product);
  if (urls.length) return urls.slice(0, max);
  return [stockPhotoForProduct(product, 800)];
}

/**
 * Admin photo names realigned to the cleaned gallery (duplicates / bad URLs dropped),
 * so each name stays on its own photo. "" = unnamed.
 */
function alignedImageNames(product, gallery) {
  const raw = Array.isArray(product?.images) ? product.images : [];
  const names = Array.isArray(product?.imageNames) ? product.imageNames : [];
  const byUrl = new Map();
  raw.forEach((u, i) => {
    const n = normalizeUrl(u);
    const name = typeof names[i] === "string" ? names[i].trim() : "";
    if (n && name && !byUrl.has(n)) byUrl.set(n, name);
  });
  return gallery.map((u) => byUrl.get(u) || "");
}

/**
 * The product as one of its named photos: card / cart / order show that photo and its name.
 * Same id and price, so stock and checkout are unchanged. `photoIndex` reopens that photo.
 */
export function productAsPhoto(product, index) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const url = images[index];
  if (!product || !url) return product;
  const name = Array.isArray(product.imageNames) ? (product.imageNames[index] || "").trim() : "";
  return {
    ...product,
    name: name || product.name,
    cardImage: url,
    photoIndex: index
  };
}

/** Ensure catalog rows always have cardImage + images for legacy/incomplete docs. */
export function enrichProduct(product) {
  if (!product || typeof product !== "object") return product;
  const fallback = stockPhotoForProduct(product);
  const gallery = adminGalleryUrls(product);
  const cardImage = normalizeUrl(product?.cardImage) || gallery[0] || fallback;
  const images = gallery.length ? gallery : [fallback];
  return {
    ...product,
    cardImage,
    images,
    imageNames: alignedImageNames(product, images)
  };
}
