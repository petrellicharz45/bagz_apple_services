export type ProductSeoInput = {
  name: string;
  category: string;
  description?: string | null;
  price?: number;
  groups?: string[];
  productId?: string;
};

export type ProductSeoFields = {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  slug: string;
};

const BRAND = "Fancy Deals Uganda";
const SITE_HINT = "fancydeals.ug";

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function slugify(name: string, productId?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  const suffix = productId ? productId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() : "";
  return suffix ? `${base}-${suffix}` : base || "product";
}

function uniqueKeywords(parts: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    if (!raw) continue;
    for (const piece of raw.split(/[,;|]/)) {
      const k = piece.trim().toLowerCase();
      if (k.length < 2 || seen.has(k)) continue;
      seen.add(k);
      out.push(piece.trim());
    }
  }
  return out;
}

/** Auto-generate Google-friendly SEO fields for a product listing. */
export function buildProductSeo(input: ProductSeoInput): ProductSeoFields {
  const name = (input.name || "").trim();
  const category = (input.category || "Shop").trim();
  const groups = input.groups || [];
  const price = Number(input.price) || 0;

  const seoTitle = truncate(
    `${name} | Buy ${category} Online Uganda | ${BRAND}`,
    60
  );

  const descBody =
    (input.description || "").trim() ||
    `Shop ${name} in ${category}. Fast delivery across Uganda, secure checkout on ${SITE_HINT}.`;

  const priceBit = price > 0 ? ` From UGX ${Math.round(price).toLocaleString("en-UG")}.` : "";

  const seoDescription = truncate(
    `${descBody}${priceBit} Order on ${BRAND}.`,
    155
  );

  const nameTokens = name.split(/\s+/).filter((w) => w.length > 2);
  const seoKeywords = uniqueKeywords([
    name,
    category,
    ...groups,
    ...nameTokens,
    "buy online Uganda",
    "online shopping Uganda",
    BRAND,
    `${category} Uganda`,
    `${name} Uganda`,
    "mobile money checkout",
    "free shipping Uganda"
  ])
    .slice(0, 18)
    .join(", ");

  return {
    seoTitle,
    seoDescription,
    seoKeywords,
    slug: slugify(name, input.productId)
  };
}

/** Merge admin overrides with auto-generated defaults. */
export function resolveProductSeo(
  input: ProductSeoInput,
  overrides?: Partial<ProductSeoFields> | null
): ProductSeoFields {
  const auto = buildProductSeo(input);
  return {
    seoTitle: overrides?.seoTitle?.trim() || auto.seoTitle,
    seoDescription: overrides?.seoDescription?.trim() || auto.seoDescription,
    seoKeywords: overrides?.seoKeywords?.trim() || auto.seoKeywords,
    slug: overrides?.slug?.trim() || auto.slug
  };
}
