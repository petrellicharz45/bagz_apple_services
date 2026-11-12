/**
 * After `vite build`, align robots.txt / sitemap.xml with VITE_PUBLIC_SITE_URL.
 * Run from shop-web: node scripts/patch-seo-files.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const site = (process.env.VITE_PUBLIC_SITE_URL || "https://fancydealsug.com").replace(/\/$/, "");

function patch(file, transform) {
  const path = join(dist, file);
  if (!existsSync(path)) return;
  writeFileSync(path, transform(readFileSync(path, "utf8")), "utf8");
}

patch("robots.txt", (text) =>
  text.replace(/Sitemap:\s*.+/i, `Sitemap: ${site}/sitemap.xml`)
);

patch("sitemap.xml", (text) =>
  text.replace(/<loc>\s*https?:\/\/[^<]+\s*<\/loc>/gi, (block) => {
    const pathMatch = block.match(/https?:\/\/[^/]+(\/[^<]*)?/i);
    if (!pathMatch) return block;
    try {
      const u = new URL(pathMatch[0]);
      const path = u.pathname === "/" ? "/" : u.pathname;
      return `<loc>${site}${path}${u.search}</loc>`;
    } catch {
      return block;
    }
  })
);

patch("index.html", (html) => {
  const ogImage = `${site}/pwa-icon-512.png`;
  const ogImageTags = [
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:secure_url" content="${ogImage}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="512" />`,
    `<meta property="og:image:height" content="512" />`
  ].join("\n    ");

  let next = html
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${site}/" />`)
    .replace(/<meta property="og:image"[^>]*\s*\/>/gi, "")
    .replace(/<meta property="og:image:[^>]*\s*\/>/gi, "")
    .replace(
      /<meta[\s\S]*?property="og:description"[\s\S]*?\/>/i,
      (block) => `${block}\n    ${ogImageTags}`
    );

  if (!/property="og:url"/i.test(next)) {
    next = next.replace(
      /<meta property="og:type" content="website"\s*\/>/i,
      `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${site}/" />`
    );
  } else {
    next = next.replace(
      /<meta property="og:url" content="[^"]*"\s*\/>/i,
      `<meta property="og:url" content="${site}/" />`
    );
  }

  if (!/name="twitter:image"/i.test(next)) {
    next = next.replace(
      /<meta name="twitter:card" content="summary_large_image"\s*\/>/i,
      `<meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:image" content="${ogImage}" />\n    <meta name="twitter:image:alt" content="Fancy Deals Uganda" />`
    );
  } else {
    next = next.replace(
      /<meta name="twitter:image" content="[^"]*"\s*\/>/i,
      `<meta name="twitter:image" content="${ogImage}" />`
    );
  }

  return next;
});

console.log(`SEO files in dist/ use site URL: ${site}`);
