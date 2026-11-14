/**
 * Some cPanel hosts return 403 for folders named _app or svelte.
 * After `npm run build`, flatten to /assets/ (same pattern as the shop).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build");
const srcImmutable = path.join(root, "adminstatic", "immutable");
const destAssets = path.join(root, "assets");

if (!fs.existsSync(srcImmutable)) {
  console.warn("patch-cpanel-build: no adminstatic/immutable — skip");
  process.exit(0);
}

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) rmrf(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, ent.name);
    const dst = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

if (fs.existsSync(destAssets)) rmrf(destAssets);
copyDir(srcImmutable, destAssets);
rmrf(path.join(root, "adminstatic"));

function walkReplace(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkReplace(p);
    else if (/\.(html|js|css)$/i.test(ent.name)) {
      let text = fs.readFileSync(p, "utf8");
      const next = text
        .replaceAll("/adminstatic/immutable/", "/assets/")
        .replaceAll("/svelte/immutable/", "/assets/")
        .replaceAll("/_app/immutable/", "/assets/");
      if (next !== text) fs.writeFileSync(p, next);
    }
  }
}

walkReplace(root);

const cpanelSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cpanel");
for (const name of ["analyze-product.php", "analyze-config.sample.php"]) {
  const from = path.join(cpanelSrc, name);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(root, name));
  }
}

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (fs.existsSync(envFile)) {
  const env = fs.readFileSync(envFile, "utf8");
  const read = (name) => {
    const line = env.split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
    let v = line ? line.slice(name.length + 1).trim() : "";
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v.includes("PASTE") ? "" : v;
  };
  const php = (v) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const key = read("OPENROUTER_API_KEY");
  // analyze-product.php checks the admin's Firebase sign-in with the (public) web API key.
  const firebaseKey = read("PUBLIC_FIREBASE_API_KEY");
  if (key) {
    fs.writeFileSync(
      path.join(root, "analyze-config.php"),
      `<?php\nreturn [\n  'OPENROUTER_API_KEY' => '${php(key)}',\n  'FIREBASE_WEB_API_KEY' => '${php(firebaseKey)}',\n];\n`
    );
  }
}

console.log("patch-cpanel-build: assets/ ready for cPanel (+ analyze-product.php)");
