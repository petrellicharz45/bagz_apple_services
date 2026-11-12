import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { SUPPORT_EMAIL } from "./shopContact.js";

const BRAND = "Fancy Deals Uganda";
const SITE_NAME = "FancyDeals";

const DEFAULT = {
  title: `${BRAND} | Online Shopping & Best Deals in Uganda`,
  description:
    "Shop fashion, electronics, home & beauty in Uganda at Fancy Deals. Kampala delivery, MTN & Airtel Money, wallet refunds, secure checkout. Uganda's deal-focused online store.",
  keywords: [
    "Fancy Deals",
    "Fancy Deals Uganda",
    "FancyDeals",
    "online shopping Uganda",
    "buy online Uganda",
    "ecommerce Uganda",
    "online store Kampala",
    "best deals Uganda",
    "cheap shopping Uganda",
    "mobile money payment Uganda",
    "MTN Mobile Money shop",
    "Airtel Money shopping",
    "delivery Kampala",
    "Uganda marketplace",
    "marketing website Uganda",
    "shop online Kampala"
  ].join(", ")
};

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const DEFAULT_OG_IMAGE = "/brand/fancy-deals-logo.jpg";

export const SHOP_SEO_PAGES = {
  home: {
    label: "Home",
    path: "/",
    title: "Fancy Deals Uganda | Online Shopping, Fashion & Best Prices in Kampala",
    description: "Shop fashion, shoes, electronics, home and beauty at Fancy Deals Uganda. Kampala delivery, MTN and Airtel Money checkout, and daily deals in UGX.",
    keywords: "Fancy Deals Uganda, online shopping Uganda, buy online Kampala, ecommerce Uganda, fashion deals Uganda, MTN Mobile Money shop, Airtel Money shopping"
  },
  newIn: {
    label: "New in",
    path: "/",
    title: "New Arrivals Uganda | Latest Fashion & Products | Fancy Deals",
    description: "See what just landed at Fancy Deals Uganda. New clothes, shoes, bags, electronics and home items, priced in UGX with delivery in Kampala.",
    keywords: "new arrivals Uganda, latest fashion Kampala, new products online Uganda, Fancy Deals new in"
  },
  categories: {
    label: "Categories",
    path: "/",
    title: "Shop by Category in Uganda | Clothes, Shoes, Electronics | Fancy Deals",
    description: "Browse Fancy Deals categories: women's clothing, men's shoes, bags, wigs, beauty, home and living, and electronics. Order online in Uganda.",
    keywords: "shop categories Uganda, women's clothing Kampala, men's shoes Uganda, home and living Uganda, beauty products Kampala"
  },
  search: {
    label: "Search",
    path: "/",
    title: "Search Products in Uganda | Fancy Deals",
    description: "Search Fancy Deals for clothes, shoes, bags, electronics and home goods. Find a product and pay with MTN or Airtel Money.",
    keywords: "search products Uganda, find shoes Kampala, buy bags online Uganda, Fancy Deals search"
  },
  cart: {
    label: "Cart",
    path: "/",
    title: "Your Cart | Fancy Deals Uganda",
    description: "Review the items in your Fancy Deals cart, check the UGX total and delivery, then continue to mobile money checkout.",
    keywords: "shopping cart Uganda, Fancy Deals cart, online order Kampala"
  },
  checkout: {
    label: "Checkout",
    path: "/",
    title: "Checkout with Mobile Money | MTN & Airtel | Fancy Deals Uganda",
    description: "Pay for your Fancy Deals order with MTN Mobile Money or Airtel Money. Delivery in Kampala and outside Kampala, prices in UGX.",
    keywords: "mobile money checkout Uganda, pay with MTN Mobile Money, Airtel Money online shop, Fancy Deals checkout"
  },
  orders: {
    label: "My orders",
    path: "/",
    title: "Track Your Order | Fancy Deals Uganda",
    description: "See your Fancy Deals orders, payment status and delivery updates. Shop online in Uganda and follow the order from your account.",
    keywords: "track order Uganda, Fancy Deals orders, delivery status Kampala"
  },
  support: {
    label: "Support",
    path: "/help/support",
    title: "Help & Customer Support | Fancy Deals Uganda",
    description: "Get help with a Fancy Deals order, delivery, payment or product. Contact Fancy Deals Uganda customer support.",
    keywords: "Fancy Deals support, customer care Uganda, online shop help Kampala, delivery help Uganda"
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
  const base = origin();
  setJsonLd("site-jsonld", {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: BRAND,
        alternateName: SITE_NAME,
        url: base || undefined,
        logo: absUrl(DEFAULT_OG_IMAGE),
        description: DEFAULT.description,
        areaServed: { "@type": "Country", name: "Uganda" },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: SUPPORT_EMAIL,
          telephone: "+256-752-918710",
          areaServed: "UG",
          availableLanguage: ["English"]
        }
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base || undefined,
        name: BRAND,
        publisher: { "@id": `${base}/#organization` },
        inLanguage: "en-UG",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${base}/?q={search_term_string}`
          },
          "query-input": "required name=search_term_string"
        }
      }
    ]
  });
}

export function productCanonicalPath(product) {
  const slug = product?.slug || product?.id;
  return slug ? `/p/${slug}` : "/";
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

export function applySupportSeo(page) {
  if (!page) {
    applyDefaultSeo();
    return;
  }
  const title = `${page.title} | ${BRAND}`;
  const description = (page.description || page.title).slice(0, 160);
  document.title = title.slice(0, 70);
  setMeta("name", "description", description);
  setMeta("name", "keywords", `${page.title}, ${BRAND}, Uganda online shopping`);
  setLink("canonical", absUrl(window.location?.pathname || "/"));
  applySocialMeta({ title, description, url: absUrl(window.location?.pathname || "/") });
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
    product.seoTitle ||
    `${product.name} | ${product.category || "Shop"} | ${BRAND}`;
  const description =
    product.seoDescription ||
    product.description ||
    `Buy ${product.name} online in Uganda on Fancy Deals. Fast delivery, mobile money payment, best prices in UGX.`;
  const keywords =
    product.seoKeywords ||
    `${product.name}, ${product.category}, buy ${product.name} Uganda, Fancy Deals`;
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

  setJsonLd("product-jsonld", {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    image: image ? [absUrl(image)] : undefined,
    sku: product.id,
    brand: { "@type": "Brand", name: BRAND },
    offers: {
      "@type": "Offer",
      priceCurrency: "UGX",
      price: Math.round(prices.current),
      availability: "https://schema.org/InStock",
      url
    }
  });
}
