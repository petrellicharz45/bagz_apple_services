/**
 * Seed Bagz Apple Services categories, category order, subcategories and product groups.
 *
 *   node scripts/seed-bagz-catalog.mjs            (dry run — prints what would change)
 *   node scripts/seed-bagz-catalog.mjs --write    (writes to Firestore)
 *
 * Needs firebase-service-account.json in the project root (firebase-admin is loaded from functions/).
 * Existing category photos are kept; existing subcategories with the same name keep their photo.
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// firebase-admin is installed in functions/ — load it from there.
const admin = createRequire(join(root, "functions", "package.json"))("firebase-admin");
const WRITE = process.argv.includes("--write");

export const CATALOG = {
  iPhones: [
    "iPhone Duo",
    "iPhone 18 Series",
    "iPhone 17 Series",
    "iPhone Air",
    "iPhone 16 Series",
    "iPhone 15 Series",
    "iPhone 14 Series",
    "iPhone 13 Series",
    "iPhone 12 Series",
    "iPhone 11 Series"
  ],
  Samsung: ["Galaxy Z Fold", "Galaxy Z Flip", "Galaxy S Series", "Galaxy A Series", "Galaxy Tab"],
  "Google Pixel": ["Pixel 10 Series", "Pixel 9 Series", "Pixel Fold", "Pixel 8 Series"],
  MacBooks: ["MacBook Air", "MacBook Pro"],
  iPads: ["iPad Pro", "iPad Air", "iPad mini", "iPad"],
  "Apple Watch": ["Apple Watch Ultra", "Apple Watch Series", "Apple Watch SE"],
  "AirPods & Audio": ["AirPods", "AirPods Pro", "AirPods Max", "Headphones", "Speakers"],
  Accessories: ["Cases & Covers", "Screen Protectors", "Chargers & Cables", "Power Banks", "Watch Bands"]
};

export const GROUPS = ["Brand New", "Certified Pre-owned", "Deals", "Recommended"];

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, "firebase-service-account.json"), "utf8")))
});
const db = admin.firestore();
const settings = db.collection("settings");

const [catSnap, subSnap, groupSnap, orderSnap] = await Promise.all(
  ["categories", "subcategories", "groups", "categoryOrder"].map((id) => settings.doc(id).get())
);
const oldCats = catSnap.exists ? catSnap.data() : {};
const oldSubs = subSnap.exists ? subSnap.data() : {};

const backupPath = join(root, `.seed-backup-${Date.now()}.json`);
writeFileSync(
  backupPath,
  JSON.stringify(
    { categories: oldCats, subcategories: oldSubs, groups: groupSnap.data() || null, categoryOrder: orderSnap.data() || null },
    null,
    2
  )
);

const isHttp = (u) => typeof u === "string" && /^https?:\/\//i.test(u);
// Keep a photo only if it was uploaded for a Bagz category (old fashion stock photos are dropped).
const categories = Object.fromEntries(
  Object.keys(CATALOG).map((name) => [name, isHttp(oldCats[name]) && !/pinimg|unsplash/i.test(oldCats[name]) ? oldCats[name] : ""])
);
const subcategories = Object.fromEntries(
  Object.entries(CATALOG).map(([cat, names]) => {
    const existing = Array.isArray(oldSubs[cat]) ? oldSubs[cat] : [];
    const byName = new Map(existing.map((s) => [String(s.name).toLowerCase(), s]));
    const seeded = names.map((name) => ({ name, imageUrl: byName.get(name.toLowerCase())?.imageUrl || "" }));
    const extras = existing.filter((s) => !names.some((n) => n.toLowerCase() === String(s.name).toLowerCase()));
    return [cat, [...seeded, ...extras]];
  })
);

console.log(`Backup of current settings → ${backupPath}`);
console.log("Removing old categories:", Object.keys(oldCats).filter((k) => !(k in CATALOG)).join(", ") || "(none)");
console.log("Categories (in order):", Object.keys(CATALOG).join(" · "));
for (const [cat, subs] of Object.entries(subcategories)) console.log(`  ${cat}: ${subs.map((s) => s.name).join(", ")}`);
console.log("Groups:", GROUPS.join(", "));

if (!WRITE) {
  console.log("\nDry run only. Re-run with --write to save.");
  process.exit(0);
}

const batch = db.batch();
batch.set(settings.doc("categories"), categories); // replace: old fashion categories are removed
batch.set(settings.doc("categoryOrder"), { list: Object.keys(CATALOG) });
batch.set(settings.doc("subcategories"), subcategories);
batch.set(settings.doc("groups"), { list: GROUPS }, { merge: true });
await batch.commit();
console.log("\nSaved to Firestore.");
process.exit(0);
