/** Audience / merchandising groups — fallback when Firestore settings/groups (Admin → Groups) is unavailable. */
/** Default merchandising groups (admin can replace them in Admin → Groups). */
export const SHOP_MERCH_GROUPS = ["Brand New", "Certified Pre-owned", "Deals", "Accessories", "Recommended"];

/** Group (and legacy category) that the admin uses to pin products to the top of the Recommended feed. */
export const RECOMMENDED = "Recommended";

function isPinnedRecommended(product) {
  return productInGroup(product, RECOMMENDED) || normalizeCategoryName(product?.category) === "recommended";
}

export const BROWSE_RECOMMENDED = "recommended";
export const BROWSE_NEW_IN = "newIn";

/** Firestore createdAt (number or Timestamp). */
export function productSortTime(product) {
  const raw = product?.createdAt ?? product?.updatedAt ?? 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && typeof raw.seconds === "number") {
    return raw.seconds * 1000;
  }
  return 0;
}

export function sortProductsNewestFirst(list) {
  return [...list].sort((a, b) => productSortTime(b) - productSortTime(a));
}

function applyBrowseSort(list) {
  return sortProductsNewestFirst(list);
}

export function categoryImageUrl(categoryImages, category) {
  const raw = categoryImages?.[category];
  if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) return raw.trim();
  return "";
}

export function normalizeCategoryName(name) {
  return `${name || ""}`.trim().toLowerCase();
}

export function productInCategory(product, category) {
  if (!category || category === "All") return true;
  return normalizeCategoryName(product?.category) === normalizeCategoryName(category);
}

export function productInGroup(product, group) {
  if (!group) return true;
  const groups = Array.isArray(product?.groups) ? product.groups : [];
  return groups.includes(group);
}

/** Filter catalog for home browse (search, category pill, or merch group). */
export function filterShopProducts(
  products,
  { search = "", category = "All", group = null, browseMode = BROWSE_RECOMMENDED, matchQuery } = {}
) {
  let out = Array.isArray(products) ? [...products] : [];
  const q = `${search || ""}`.trim();

  if (!q) {
    if (group) {
      out = out.filter((p) => productInGroup(p, group));
    } else if (category && category !== "All") {
      out = out.filter((p) => productInCategory(p, category));
    }
  } else if (typeof matchQuery === "function") {
    out = out.filter((p) => matchQuery(p, search));
  }

  const sorted = applyBrowseSort(out, browseMode);
  const isRecommendedFeed =
    !q && !group && (!category || category === "All") && browseMode === BROWSE_RECOMMENDED;
  if (!isRecommendedFeed) return sorted;
  // Products ticked "Recommended" in the admin come first.
  return [...sorted.filter(isPinnedRecommended), ...sorted.filter((p) => !isPinnedRecommended(p))];
}

export function buildBrowsePills(categories = [], merchGroups = SHOP_MERCH_GROUPS) {
  const pills = [
    { id: "all", label: "Recommended", category: "All", group: null, browseMode: BROWSE_RECOMMENDED },
    { id: "new-in", label: "New In", category: "All", group: null, browseMode: BROWSE_NEW_IN }
  ];
  const seen = new Set(["recommended", "new in"]);

  for (const cat of categories) {
    if (!cat) continue;
    const norm = normalizeCategoryName(cat);
    if (seen.has(norm)) continue;
    seen.add(norm);
    pills.push({
      id: `cat:${cat}`,
      label: pillLabelForCategory(cat),
      category: cat,
      group: null,
      browseMode: BROWSE_RECOMMENDED
    });
  }
  for (const g of merchGroups) {
    const norm = normalizeCategoryName(g);
    if (seen.has(norm)) continue;
    seen.add(norm);
    pills.push({
      id: `grp:${g}`,
      label: pillLabelForGroup(g),
      category: "All",
      group: g,
      browseMode: BROWSE_RECOMMENDED
    });
  }
  return pills;
}

export function pillLabelForCategory(cat) {
  if (cat === "Beauty") return "Beauty & Personal Care";
  if (cat === "Clothing") return "Women's Clothing";
  if (cat === "Bags") return "Bags & Luggage";
  return cat;
}

export function pillLabelForGroup(g) {
  if (g === "Home Utilities") return "Home & Utilities";
  return g;
}

export function browsePillActive(pill, { category, group, browseMode = BROWSE_RECOMMENDED }) {
  const mode = pill.browseMode || BROWSE_RECOMMENDED;
  if (mode === BROWSE_NEW_IN) {
    return browseMode === BROWSE_NEW_IN && !group && category === "All";
  }
  if (pill.group) {
    return browseMode !== BROWSE_NEW_IN && group === pill.group && category === "All";
  }
  if (pill.category === "All") {
    return browseMode !== BROWSE_NEW_IN && !group && category === "All";
  }
  return browseMode !== BROWSE_NEW_IN && !group && category === pill.category;
}
