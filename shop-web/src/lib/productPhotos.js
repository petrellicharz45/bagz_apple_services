/** Curated stock photos (Unsplash) — used when product has no/broken image URL. */
const U = (id, w = 600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${w}&q=80`;

const STOCK = {
  sunglasses: U("photo-1572635196237-14b3e281a0b3"),
  lipstick: U("photo-1586495777744-44168d6d9293"),
  beauty: U("photo-1596462502278-27bfdc403348"),
  foundation: U("photo-1522335789203-aabd1fc54bc9"),
  earrings: U("photo-1535632066927-ab7c9ab60908"),
  jewelry: U("photo-1515562141203-7a88fb7ce338"),
  bag: U("photo-1584916201218-f4242ceb4809"),
  backpack: U("photo-1553062407-98eeb64c6a62"),
  hat: U("photo-1521369909029-2afed882baee"),
  clothing: U("photo-1483985988355-763728e1935b"),
  dress: U("photo-1595777453373-55b39a4d4b6f"),
  shoes: U("photo-1549298916-b41d501d3772"),
  sneakers: U("photo-1606107557195-0f29cb4f3bcd"),
  watch: U("photo-1523275335684-37898b6baf30"),
  phone: U("photo-1601784551446-20c9e07cdbdb"),
  belt: U("photo-1624222247344-550fb60583fd"),
  general: U("photo-1472851294607-0627dbdaad7a")
};

const CATEGORY_STOCK = {
  shoes: STOCK.shoes,
  clothing: STOCK.clothing,
  accessories: STOCK.sunglasses,
  bags: STOCK.bag,
  jewelry: STOCK.jewelry,
  beauty: STOCK.beauty
};

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
    [/sunglass|aviator|shade/, STOCK.sunglasses],
    [/lipstick|lip gloss|matte lip|lip /, STOCK.lipstick],
    [/foundation|makeup set|maange/, STOCK.foundation],
    [/serum|skincare|face mask|beauty|hair styling/, STOCK.beauty],
    [/earring|butterfly/, STOCK.earrings],
    [/necklace|bracelet|pearl|jewel/, STOCK.jewelry],
    [/backpack|duffel|laptop sleeve/, STOCK.backpack],
    [/tote|handbag|crossbody|shoulder bag|mini bag|gym bag/, STOCK.bag],
    [/beanie|cap adjustable|knit/, STOCK.hat],
    [/dress|linen|hoodie|jogger|polo|shirt|trouser|pattern shirt/, STOCK.clothing],
    [/sneaker|running|loafer|sandal|slide|canvas slip|formal shoe|leather casual/, STOCK.shoes],
    [/watch|smart watch/, STOCK.watch],
    [/phone case|earbuds/, STOCK.phone],
    [/belt/, STOCK.belt]
  ];

  for (const [re, url] of rules) {
    if (re.test(name)) {
      return size === 600 ? url : url.replace("w=600", `w=${size}`).replace("h=600", `h=${size}`);
    }
  }

  for (const [key, url] of Object.entries(CATEGORY_STOCK)) {
    if (cat.includes(key)) {
      return size === 600 ? url : url.replace("w=600", `w=${size}`).replace("h=600", `h=${size}`);
    }
  }

  return size === 600 ? STOCK.general : STOCK.general.replace("w=600", `w=${size}`).replace("h=600", `h=${size}`);
}

export function stockPhotoForCategory(category, size = 320) {
  const cat = `${category || ""}`.toLowerCase();
  for (const [key, url] of Object.entries(CATEGORY_STOCK)) {
    if (cat.includes(key)) {
      return size === 600 ? url : url.replace("w=600", `w=${size}`).replace("h=600", `h=${size}`);
    }
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
