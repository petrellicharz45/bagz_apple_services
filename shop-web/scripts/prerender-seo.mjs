/**
 * Build-time SEO for the shop SPA. Run after `vite build` (part of `npm run build`).
 *
 * Google and social apps read the first HTML they receive. The shop renders in the browser,
 * so this script writes real HTML for every public page, using the live catalogue:
 *   dist/p/<slug>.html   one per visible product (title, description, price, stock, Product JSON-LD)
 *   dist/c/<slug>.html   one per category (product list + CollectionPage JSON-LD)
 *   dist/index.html      home: store/branch JSON-LD + crawlable links to categories and products
 *   dist/sitemap.xml     every page above + help pages, with lastmod
 * The app clears this content and takes over as soon as it loads (src/main.js).
 * .htaccess serves /p/<slug> from p/<slug>.html.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { BRAND } from "../src/lib/brand.js";
import { categoryPath, categorySlug, productPath, productSeoTitle } from "../src/lib/seoPaths.js";
import { siteGraph, productGraph, categoryGraph } from "../src/lib/seoSchema.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// ---------- env (same files Vite uses for a production build) ----------
const env = { ...process.env };
for (const f of [".env", ".env.production"]) {
  const path = join(root, f);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) env[m[1]] = m[2];
  }
}
const SITE = (env.VITE_PUBLIC_SITE_URL || BRAND.siteUrl).replace(/\/$/, "");
if (!env.VITE_FIREBASE_PROJECT_ID) {
  console.warn("prerender-seo: no Firebase config — skipped.");
  process.exit(0);
}

// ---------- data ----------
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);
const [prodSnap, catSnap, orderSnap] = await Promise.all([
  getDocs(collection(db, "product")),
  getDoc(doc(db, "settings", "categories")),
  getDoc(doc(db, "settings", "categoryOrder"))
]);
const products = prodSnap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((p) => p.hidden !== true && p.name && Number(p.price) > 0)
  .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
const order = orderSnap.exists() ? orderSnap.data().list || [] : [];
const catNames = Object.keys(catSnap.exists() ? catSnap.data() : {}).filter((k) => k && !k.startsWith("_"));
const categories = [...order.filter((c) => catNames.includes(c)), ...catNames.filter((c) => !order.includes(c)).sort()];

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ugx = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const truncate = (t, n) => {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
};
const abs = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`);
function currentPrice(p) {
  const price = Number(p.price) || 0;
  const off = Number(p.offerPercentage) || 0;
  const now = Date.now();
  if (off <= 0) return price;
  if (p.saleStartAt && now < p.saleStartAt) return price;
  if (p.saleEndAt && now >= p.saleEndAt) return price;
  return Math.round(price * (1 - off / 100));
}
const cover = (p) => p.cardImage || (Array.isArray(p.images) ? p.images[0] : "") || "";
const lastmod = (p) => {
  const t = Number(p.updatedAt || p.importedAt || p.createdAt) || Date.now();
  return new Date(t).toISOString().slice(0, 10);
};

const template = readFileSync(join(dist, "index.html"), "utf8");

/** Replace one tag in <head> (or add it before </head>). */
function setHead(html, re, tag) {
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function page({ title, description, path, image = BRAND.ogImage, type = "website", keywords = "", jsonld = [], body }) {
  const url = `${SITE}${path}`;
  const img = abs(image);
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(truncate(title, 70))}</title>`);
  html = setHead(html, /<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${esc(truncate(description, 160))}" />`);
  if (keywords) html = setHead(html, /<meta\s+name="keywords"[\s\S]*?\/>/i, `<meta name="keywords" content="${esc(keywords)}" />`);
  html = setHead(html, /<link rel="canonical"[^>]*\/>/i, `<link rel="canonical" href="${esc(url)}" />`);
  html = html.replace(/<meta property="og:(title|description|url|type|image)(:[a-z_]+)?"[^>]*\/>\s*/gi, "");
  html = html.replace(/<meta name="twitter:(title|description|image)(:alt)?"[^>]*\/>\s*/gi, "");
  const social = [
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${esc(truncate(title, 90))}" />`,
    `<meta property="og:description" content="${esc(truncate(description, 200))}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta name="twitter:title" content="${esc(truncate(title, 70))}" />`,
    `<meta name="twitter:description" content="${esc(truncate(description, 200))}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`
  ];
  const ld = [siteGraph(SITE), ...jsonld].map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`);
  html = html.replace("</head>", `    ${social.join("\n    ")}\n    ${ld.join("\n    ")}\n  </head>`);
  html = html.replace(/<div id="app"><\/div>/, `<div id="app">${body}</div>`);
  return html;
}

const style = `<style>.seo-prerender{max-width:1100px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;color:#13344f;line-height:1.5}.seo-prerender a{color:#1673c4}.seo-prerender img{max-width:280px;height:auto;border-radius:12px}.seo-prerender ul{padding-left:18px}.seo-prerender .price{font-size:22px;font-weight:700}</style>`;
const nav = () =>
  `<nav aria-label="Categories"><a href="/">Home</a> · ${categories.map((c) => `<a href="${categoryPath(c)}">${esc(c)}</a>`).join(" · ")}</nav>`;
const contact = () =>
  `<p>${esc(BRAND.name)} — ${esc(BRAND.tagline)}. Call or WhatsApp <a href="tel:${BRAND.contact.phoneTel}">${esc(BRAND.contact.phoneDisplay)}</a>. ` +
  BRAND.branches.map((b) => `${esc(b.name)}: ${esc(b.address)}.`).join(" ") +
  `</p>`;

const written = { products: 0, categories: 0 };
const byCategory = new Map(categories.map((c) => [c, []]));
for (const p of products) if (byCategory.has(p.category)) byCategory.get(p.category).push(p);

// ---------- product pages ----------
mkdirSync(join(dist, "p"), { recursive: true });
for (const p of products) {
  const slug = productPath(p).slice(3);
  if (!slug || /[\/\\]/.test(slug)) continue;
  const price = currentPrice(p);
  const inStock = Number(p.stock) > 0;
  const description = p.seoDescription || truncate(p.description, 155) || `Buy ${p.name} in Kampala at ${BRAND.name}.`;
  const title = p.seoTitle && p.seoTitle.length <= 65 ? p.seoTitle : productSeoTitle(p.name, BRAND.name);
  const related = (byCategory.get(p.category) || []).filter((x) => x.id !== p.id).slice(0, 8);
  const body = `${style}<main class="seo-prerender">${nav()}
<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${categoryPath(p.category)}">${esc(p.category)}</a> › ${esc(p.name)}</nav>
<article><h1>${esc(p.name)}</h1>
${cover(p) ? `<img src="${esc(cover(p))}" alt="${esc(p.name)}" width="280" height="280" />` : ""}
<p class="price">${ugx(price)}</p><p>${inStock ? "In stock" : "Out of stock"} · Same-day delivery in Kampala · upcountry 1–3 days</p>
<div>${esc(p.description || "").replace(/\n/g, "<br />")}</div></article>
${related.length ? `<h2>More ${esc(p.category)}</h2><ul>${related.map((r) => `<li><a href="${productPath(r)}">${esc(r.name)}</a> — ${ugx(currentPrice(r))}</li>`).join("")}</ul>` : ""}
${contact()}</main>`;
  const html = page({
    title,
    description,
    path: productPath(p),
    image: cover(p) || BRAND.ogImage,
    type: "product",
    keywords: p.seoKeywords || `${p.name}, ${p.name} price in Uganda, ${p.category} Kampala, ${BRAND.name}`,
    jsonld: [
      productGraph(SITE, p, {
        price,
        image: abs(cover(p)),
        images: (p.images || []).filter(Boolean).slice(0, 6).map(abs),
        description: p.description || description
      })
    ],
    body
  });
  writeFileSync(join(dist, "p", `${slug}.html`), html);
  written.products++;
}

// ---------- category pages ----------
mkdirSync(join(dist, "c"), { recursive: true });
for (const cat of categories) {
  const list = byCategory.get(cat) || [];
  const prices = list.map(currentPrice).filter((n) => n > 0);
  const range = prices.length ? ` from ${ugx(Math.min(...prices))}` : "";
  const title = `${cat} Price in Uganda | Buy ${cat} in Kampala | ${BRAND.name}`;
  const description = `Shop ${list.length ? list.length + " " : ""}authentic ${cat} at ${BRAND.name}, Kampala${range}. Warranty, same-day delivery in Kampala and mobile money payment.`;
  const body = `${style}<main class="seo-prerender">${nav()}
<h1>${esc(cat)} in Uganda</h1><p>${esc(description)}</p>
<ul>${list.map((p) => `<li><a href="${productPath(p)}">${esc(p.name)}</a> — ${ugx(currentPrice(p))}</li>`).join("")}</ul>
${contact()}</main>`;
  writeFileSync(
    join(dist, "c", `${categorySlug(cat)}.html`),
    page({
      title,
      description,
      path: categoryPath(cat),
      image: list[0] ? cover(list[0]) || BRAND.ogImage : BRAND.ogImage,
      keywords: `${cat} price in Uganda, buy ${cat} Kampala, ${cat} Uganda, ${BRAND.name}`,
      jsonld: [categoryGraph(SITE, cat, list)],
      body
    })
  );
  written.categories++;
}

// ---------- home ----------
{
  const featured = products.slice(0, 40);
  const body = `${style}<main class="seo-prerender">${nav()}
<h1>${esc(BRAND.name)} — Authentic iPhones, Samsung, Pixel, MacBooks &amp; Accessories in Kampala</h1>
<p>${esc(BRAND.description)}</p>
<h2>Shop by category</h2><ul>${categories.map((c) => `<li><a href="${categoryPath(c)}">${esc(c)}</a> (${(byCategory.get(c) || []).length})</li>`).join("")}</ul>
<h2>Latest products</h2><ul>${featured.map((p) => `<li><a href="${productPath(p)}">${esc(p.name)}</a> — ${ugx(currentPrice(p))}</li>`).join("")}</ul>
${contact()}</main>`;
  const homeTitle = `${BRAND.name} | Authentic iPhones & Samsung in Kampala`;
  writeFileSync(
    join(dist, "index.html"),
    page({ title: homeTitle, description: BRAND.description, path: "/", body })
  );
}

// ---------- sitemap ----------
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: "/", lastmod: today, changefreq: "daily", priority: "1.0" },
  ...categories.map((c) => ({ loc: categoryPath(c), lastmod: today, changefreq: "daily", priority: "0.9" })),
  ...products.map((p) => ({ loc: productPath(p), lastmod: lastmod(p), changefreq: "weekly", priority: "0.8" }))
  // Help pages are left out until they get their own prerendered title/canonical
  // (today they share the home page's, which Search Console reports as a conflict).
];
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(SITE + u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n") +
    `\n</urlset>\n`
);

// ---------- old WordPress links → new pages (301) ----------
// Keeps Google rankings and shared links working after the WordPress site is replaced.
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const visible = new Set(products.map((p) => p.id));
const redirects = [];
const seenOld = new Set();
for (const d of prodSnap.docs) {
  const p = { id: d.id, ...d.data() };
  let oldPath = "";
  try {
    oldPath = new URL(p.wpUrl).pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    continue;
  }
  if (!/^product\/[^/]+$/.test(oldPath) || seenOld.has(oldPath)) continue;
  seenOld.add(oldPath);
  // Visible product → its page; product still hidden (needs photo / price check) → its category.
  const target = visible.has(p.id) ? productPath(p) : p.category ? categoryPath(p.category) : "/";
  redirects.push(`  RewriteRule ^${rx(oldPath)}/?$ ${target} [R=301,L]`);
}
// Old category pages: match on keywords against today's categories.
const CATEGORY_KEYWORDS = [
  ["iphone", "iphone"], ["samsung", "samsung"], ["galaxy", "samsung"], ["pixel", "pixel"], ["google", "pixel"],
  ["watch", "watch"], ["macbook", "macbook"], ["ipad", "ipad"], ["airpod", "airpod"], ["audio", "audio"],
  ["speaker", "audio"], ["headphone", "audio"], ["accessor", "accessor"], ["charger", "accessor"], ["case", "accessor"]
];
for (const [word, catWord] of CATEGORY_KEYWORDS) {
  const cat = categories.find((c) => categorySlug(c).includes(catWord));
  if (cat) redirects.push(`  RewriteRule ^product-category/(.*)${word} ${categoryPath(cat)} [R=301,L,NC]`);
}
redirects.push(
  "  RewriteRule ^product-category/ / [R=301,L]",
  "  RewriteRule ^product/ / [R=301,L]",
  "  RewriteRule ^(shop|cart|checkout|my-account|wishlist|compare)/?$ / [R=301,L,NC]",
  "  # WordPress login / admin addresses no longer exist",
  "  RewriteRule ^(wp-admin|wp-login\\.php|xmlrpc\\.php|wp-includes) - [G,L]"
);
const htaccessPath = join(dist, ".htaccess");
if (existsSync(htaccessPath)) {
  const marker = /^\s*# LEGACY-REDIRECTS.*$/m;
  const ht = readFileSync(htaccessPath, "utf8");
  if (marker.test(ht)) {
    writeFileSync(htaccessPath, ht.replace(marker, (m) => `${m}\n${redirects.join("\n")}`));
  }
}

console.log(`prerender-seo: ${written.products} product pages, ${written.categories} category pages, sitemap with ${urls.length} URLs, ${seenOld.size} old WordPress links redirected (${SITE})`);
process.exit(0);
