import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { coverUrl, stockPhotoForCategory, stockPhotoForProduct } from "./catalog.js";
import { categoryKeysFromSettings, imageMapFromSettings } from "./categoryImages.js";
import { SHOP_MERCH_GROUPS, filterShopProducts, sortProductsNewestFirst } from "./shopBrowse.js";

const VIRTUAL_CATEGORIES = new Set(["Just for You", "New In", "Sale"]);

/** Full offline fallback (used when Firestore menu is unavailable). */
const STATIC_MENU_GROUPS = [
  {
    id: "featured",
    label: "Featured",
    subs: [
      { label: "Best sellers", hot: true, tab: "shop" },
      { label: "5-Star picks", hot: true, tab: "trends" },
      { label: "Mega sale", hot: true, tab: "trends" },
      { label: "New arrivals", tab: "shop", browseMode: "newIn" },
      { label: "Gift ideas", query: "gift" },
      { label: "Daily deals", hot: true, tab: "trends" }
    ]
  },
  {
    id: "iphone",
    label: "iPhone",
    subs: [
      { label: "iPhone 18 series", filterCategory: "iPhones", query: "iphone 18", hot: true },
      { label: "iPhone Duo", filterCategory: "iPhones", query: "duo", hot: true },
      { label: "iPhone 17 series", filterCategory: "iPhones", query: "iphone 17" },
      { label: "iPhone Air", filterCategory: "iPhones", query: "air" },
      { label: "Older models", filterCategory: "iPhones" }
    ]
  },
  {
    id: "android",
    label: "Pixel & Samsung",
    subs: [
      { label: "Google Pixel", filterCategory: "Google Pixel", hot: true },
      { label: "Samsung Z Fold / Flip", filterCategory: "Samsung", query: "z " },
      { label: "Samsung Galaxy S", filterCategory: "Samsung", query: "galaxy s" }
    ]
  },
  {
    id: "mac",
    label: "Mac, iPad & Watch",
    subs: [
      { label: "MacBooks", filterCategory: "MacBooks & iPads", query: "macbook" },
      { label: "iPads", filterCategory: "MacBooks & iPads", query: "ipad" },
      { label: "Apple Watch", filterCategory: "Apple Watch" }
    ]
  },
  {
    id: "accessories",
    label: "Audio & accessories",
    subs: [
      { label: "AirPods & audio", filterCategory: "Audio", hot: true },
      { label: "Cases & protectors", filterCategory: "Accessories", query: "case" },
      { label: "Chargers & cables", filterCategory: "Accessories", query: "charger" }
    ]
  }
];

export const CATEGORY_GROUPS = STATIC_MENU_GROUPS;

function slugId(text) {
  return String(text || "cat")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Stock category used for each Featured tile (always has a valid image URL). */
const FEATURED_STOCK_CATEGORY = {
  "Best sellers": "iPhones",
  "5-Star picks": "iPhones",
  "Mega sale": "Google Pixel",
  "New In": "iPhones",
  "New arrivals": "iPhones",
  "Gift ideas": "Accessories",
  "Daily deals": "Accessories"
};

function featuredSubs() {
  return [
    { label: "Best sellers", hot: true, tab: "shop" },
    { label: "5-Star picks", hot: true, tab: "trends" },
    { label: "Mega sale", hot: true, tab: "trends" },
    { label: "New In", tab: "shop", browseMode: "newIn" },
    { label: "Daily deals", hot: true, tab: "trends" }
  ];
}

export function featuredSubImage(label, products = []) {
  const stockCat = FEATURED_STOCK_CATEGORY[label] || "Accessories";
  if (label === "Best sellers" && products.length) {
    const special = products.find((p) => p.special);
    const pick = special || products[0];
    const fromProduct = menuThumbUrl(coverUrl(pick));
    if (fromProduct) return fromProduct;
  }
  if ((label === "New In" || label === "New arrivals") && products.length) {
    const pick = sortProductsNewestFirst(products)[0];
    const fromProduct = menuThumbUrl(coverUrl(pick));
    if (fromProduct) return fromProduct;
  }
  const catProduct = products.find((p) => p.category === stockCat);
  if (catProduct) {
    const fromProduct = menuThumbUrl(coverUrl(catProduct));
    if (fromProduct) return fromProduct;
  }
  return stockPhotoForCategory(stockCat, 200);
}

function subFromFirestore(mainCategory, item, categoryImages) {
  const name = item?.name || item?.label || "Shop";
  const imageUrl =
    menuThumbUrl(item?.imageUrl) ||
    menuThumbUrl(item?.image) ||
    menuThumbUrl(categoryImages[mainCategory]) ||
    "";
  const virtual = VIRTUAL_CATEGORIES.has(mainCategory);
  if (virtual) {
    if (mainCategory === "Sale") return { label: name, tab: "trends", imageUrl, hot: true };
    if (mainCategory === "New In") return { label: name, tab: "shop", query: name, imageUrl };
    return { label: name, tab: "shop", query: name, imageUrl };
  }
  return {
    label: name,
    filterCategory: mainCategory,
    query: name,
    imageUrl
  };
}

/** Admin-managed merchandising groups (settings/groups.list). */
export async function loadMerchGroups() {
  try {
    const snap = await getDoc(doc(db, "settings", "groups"));
    const list = snap.exists() ? snap.data().list : null;
    if (Array.isArray(list)) return list.filter((g) => typeof g === "string" && g.trim());
  } catch {
    /* fall back below */
  }
  return [...SHOP_MERCH_GROUPS];
}

/** Load admin-managed categories + subcategories from Firestore. */
export async function loadBrowseMenu() {
  try {
    const [catSnap, subSnap] = await Promise.all([
      getDoc(doc(db, "settings", "categories")),
      getDoc(doc(db, "settings", "subcategories"))
    ]);
    const rawCats = catSnap.exists() ? catSnap.data() : {};
    const categoryImages = imageMapFromSettings(rawCats);
    const catNames = categoryKeysFromSettings(rawCats);
    const subMap = subSnap.exists() ? subSnap.data() : {};

    if (!catNames.length) {
      return { groups: null, categoryImages: {} };
    }

    const groups = [{ id: "featured", label: "Featured", subs: featuredSubs() }];

    for (const cat of catNames) {
      const raw = Array.isArray(subMap[cat]) ? subMap[cat] : [];
      let subs = raw.map((item) => subFromFirestore(cat, item, categoryImages));
      if (!subs.length) {
        subs = [
          {
            label: `Shop ${cat}`,
            filterCategory: VIRTUAL_CATEGORIES.has(cat) ? null : cat,
            query: VIRTUAL_CATEGORIES.has(cat) ? cat : "",
            imageUrl: menuThumbUrl(categoryImages[cat]) || "",
            tab: cat === "Sale" ? "trends" : "shop"
          }
        ];
      }
      groups.push({
        id: slugId(cat),
        label: cat,
        subs
      });
    }

    return { groups, categoryImages };
  } catch {
    return { groups: null, categoryImages: {} };
  }
}

export function resolveMenuGroups(flatCategories = [], browseGroups = null) {
  if (browseGroups?.length) return browseGroups;
  return groupsWithShopCategories(flatCategories, STATIC_MENU_GROUPS);
}

/** Append flat shop category names not present in static tree. */
export function groupsWithShopCategories(flatCategories = [], baseGroups = STATIC_MENU_GROUPS) {
  const known = new Set(
    baseGroups.flatMap((g) => g.subs.map((s) => s.filterCategory).filter(Boolean))
  );
  const extra = flatCategories.filter((c) => c && !known.has(c));
  const base = [...baseGroups];
  if (!extra.length) return base;
  return [
    ...base,
    {
      id: "shop-all",
      label: "Shop categories",
      subs: extra.map((c) => ({ label: c, filterCategory: c }))
    }
  ];
}

export function picsumThumb(seed) {
  return stockPhotoForProduct({ name: seed, category: seed }, 200);
}

function menuThumbUrl(value) {
  if (!value || typeof value !== "string") return "";
  const t = value.trim();
  if (!t.startsWith("http://") && !t.startsWith("https://") && !t.startsWith("//")) return "";
  return t.startsWith("//") ? `https:${t}` : t;
}

export function thumbForSub(sub, products, categoryImages = {}) {
  const label = sub?.label;
  if (label && FEATURED_STOCK_CATEGORY[label]) {
    return featuredSubImage(label, products);
  }

  const fromSub = menuThumbUrl(sub?.imageUrl);
  if (fromSub) return fromSub;

  const cat = sub.filterCategory;
  const fromCat = cat ? menuThumbUrl(categoryImages[cat]) : "";
  if (fromCat) return fromCat;

  if (sub.query && `${sub.query}`.trim()) {
    const q = sub.query.toLowerCase().trim();
    const p = products.find((x) => `${x.name} ${x.category}`.toLowerCase().includes(q.split(" ")[0]));
    const fromProduct = p ? menuThumbUrl(coverUrl(p)) : "";
    if (fromProduct) return fromProduct;
  }

  if (cat) {
    const p = products.find((x) => x.category === cat);
    if (p) {
      const fromProduct = menuThumbUrl(coverUrl(p));
      if (fromProduct) return fromProduct;
    }
    return stockPhotoForCategory(cat, 200);
  }

  return stockPhotoForCategory("Accessories", 200);
}

/** @returns {{ filterCategory?: string, query?: string, tab?: string }} */
export function selectionFromSub(sub) {
  if (!sub) return {};
  return {
    filterCategory: sub.filterCategory || null,
    query: sub.query || "",
    tab: sub.tab || "shop",
    browseMode: sub.browseMode || "recommended"
  };
}

/** Sidebar icon name for TemuIcon (shop category groups). */
export function iconForMenuGroup(group) {
  const id = group?.id || "";
  const label = `${group?.label || ""}`.toLowerCase();
  if (id === "featured") return "star";
  if (id === "iphone" || label.includes("iphone") || label.includes("apple")) return "apple";
  if (id === "android" || label.includes("pixel") || label.includes("samsung") || label.includes("android")) return "android";
  if (label.includes("watch")) return "watch";
  if (label.includes("ipad") || label.includes("tablet")) return "tablet";
  if (id === "mac" || label.includes("mac") || label.includes("laptop")) return "laptop";
  if (label.includes("audio") || label.includes("airpod") || label.includes("headphone")) return "headset";
  if (label.includes("charg") || label.includes("cable")) return "plug";
  if (label.includes("accessor") || label.includes("case")) return "tag";
  if (label.includes("swap") || label.includes("trade")) return "swap";
  if (label.includes("phone")) return "phone";
  return "grid";
}

/** Temu-style chips for a category browse page (Firestore-backed). */
export function browseChipsForCategory(category, browseGroups = []) {
  const cat = category && category !== "All" ? category : "";
  if (!cat) return [{ id: "all", label: "All", filterCategory: "All", query: "" }];

  const group =
    browseGroups?.find((g) => g.label === cat) ||
    browseGroups?.find((g) => g.id === slugId(cat));

  const chips = [{ id: "all", label: "All", filterCategory: cat, query: "" }];
  if (!group?.subs?.length) return chips;

  for (const sub of group.subs) {
    const shopOnly = sub.label === `Shop ${cat}` || sub.label === cat;
    if (shopOnly) continue;
    const sel = selectionFromSub(sub);
    chips.push({
      id: sub.label,
      label: sub.label,
      filterCategory: sel.filterCategory || cat,
      query: sel.query || "",
      imageUrl: sub.imageUrl || "",
      hot: sub.hot
    });
  }
  return chips;
}

export function productsForBrowseChip(products, chip, { group = null, browseMode = "recommended" } = {}) {
  const cat = chip?.filterCategory || "All";
  let out = filterShopProducts(products, {
    category: group ? "All" : cat,
    group,
    browseMode,
    search: ""
  });

  const q = `${chip?.query || ""}`.trim().toLowerCase();
  if (q && chip?.id !== "all") {
    out = out.filter((p) => `${p?.name || ""} ${p?.category || ""}`.toLowerCase().includes(q));
  }

  return sortProductsNewestFirst(out);
}
