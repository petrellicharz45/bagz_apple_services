/**
 * Hostinger deploy bundle — avoids CDN/cache issues from partial uploads.
 *
 * Why production broke (verified, not guessed):
 * 1. SPA .htaccess serves index.html for missing files under /assets/.
 * 2. Hostinger CDN (hcdn) cached those HTML responses for asset URLs (7d TTL).
 * 3. Zip extract + manual uploads left index.html and assets/ out of sync.
 *
 * This script: stable filenames app.js + app.css, patched index.html, full zip.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const assetsDir = path.join(dist, "assets");
const outZip = path.join(root, "..", "deploy", "hostinger", "packages", "bagz-shop-upload.zip");

const APP_JS = "app.js";
const APP_CSS = "app.css";

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function findHashedAsset(dir, ext) {
  const names = fs.readdirSync(dir).filter((n) => n.startsWith("index-") && n.endsWith(ext));
  if (names.length === 0) throw new Error(`No index-*.${ext} in ${dir}`);
  names.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  return names[0];
}

run("npm run build");

const hashedJs = findHashedAsset(assetsDir, ".js");
const hashedCss = findHashedAsset(assetsDir, ".css");
fs.copyFileSync(path.join(assetsDir, hashedJs), path.join(assetsDir, APP_JS));
fs.copyFileSync(path.join(assetsDir, hashedCss), path.join(assetsDir, APP_CSS));

let html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
html = html.replace(/src="\/assets\/[^"]+\.js"/, `src="/assets/${APP_JS}"`);
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/,
  `<link rel="stylesheet" href="/assets/${APP_CSS}" />`
);
fs.writeFileSync(path.join(dist, "index.html"), html);

// Service worker: new cache id each Hostinger build
const swPath = path.join(dist, "sw.js");
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, "utf8");
  sw = sw.replace(/bagz-shop-v\d+/, `bagz-shop-v${Date.now()}`);
  fs.writeFileSync(swPath, sw);
}

fs.mkdirSync(path.dirname(outZip), { recursive: true });
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
// PowerShell Compress-Archive uses backslashes — Hostinger/Linux treats them as literal filenames.
// Windows tar -a produces a zip with proper paths for Linux hosting.
run(`tar -a -cf "${outZip}" -C "${dist}" .`);

const jsSize = fs.statSync(path.join(assetsDir, APP_JS)).size;
const cssSize = fs.statSync(path.join(assetsDir, APP_CSS)).size;
console.log("\nHostinger bundle ready:");
console.log(`  Zip: ${outZip}`);
console.log(`  Assets: /assets/${APP_JS} (${jsSize} bytes), /assets/${APP_CSS} (${cssSize} bytes)`);
console.log("  Upload: extract entire zip into public_html (overwrite all).");
