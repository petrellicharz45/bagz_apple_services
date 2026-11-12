/**
 * Write products built by build_products.py into Firestore.
 *
 *   node scripts/import-bagz/write_products.mjs           # dry run: summary only
 *   node scripts/import-bagz/write_products.mjs --write   # save
 *
 * - Products are saved as product/wp-<oldSiteId>, so re-running updates them instead of duplicating.
 * - Only documents created by this importer (source "bagz-wp") are overwritten; products added in the
 *   admin are never touched. If you already edited an imported product in the admin (price, photos,
 *   hidden…), pass --keep-edited to skip products whose updatedAt is newer than their import.
 * - Also renames the "Apple Watch" category to "Watches" (keeping its photo) and adds a few
 *   subcategories that match the imported catalogue.
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const admin = createRequire(join(root, "functions", "package.json"))("firebase-admin");
const WRITE = process.argv.includes("--write");
const KEEP_EDITED = process.argv.includes("--keep-edited");

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, "firebase-service-account.json"), "utf8")))
});
const db = admin.firestore();

const built = JSON.parse(readFileSync(join(here, "out", "products.json"), "utf8"));
const now = Date.now();

// ---------- products ----------
const existing = new Map();
for (const d of (await db.collection("product").where("source", "==", "bagz-wp").get()).docs) existing.set(d.id, d.data());
const others = (await db.collection("product").get()).size - existing.size;

const docs = [];
let skippedEdited = 0;
for (const p of built) {
  const prev = existing.get(p.id);
  if (KEEP_EDITED && prev && prev.updatedAt && prev.importedAt && prev.updatedAt > prev.importedAt) {
    skippedEdited++;
    continue;
  }
  const { order, _copySource, ...data } = p;
  data.createdAt = prev?.createdAt || now - order * 1000; // keep the old site's order (first = newest)
  data.importedAt = now;
  data.deliveryEstimateDays = 2;
  data.deliveryEstimateLabel = "2 business days";
  data.deliveryStartAt = null;
  data.deliveryEndAt = null;
  docs.push(data);
}

const byCat = {};
for (const d of docs) {
  const c = (byCat[d.category] ||= { total: 0, visible: 0, hidden: 0, priceCheck: 0 });
  c.total++;
  if (d.hidden) c.hidden++;
  else c.visible++;
  if (d.hiddenReason === "price-check") c.priceCheck++;
}
console.log(`Products to write: ${docs.length} (${existing.size} already imported will be updated)`);
console.log(`Other products in the shop (added in admin, untouched): ${others}`);
if (KEEP_EDITED) console.log(`Skipped because edited in admin since import: ${skippedEdited}`);
console.table(byCat);
const flagged = docs.filter((d) => d.hiddenReason === "price-check");
if (flagged.length) console.log("Hidden for price check:", flagged.map((d) => `${d.name} (UGX ${d.price.toLocaleString()})`).join("; "));

// ---------- categories ----------
const settings = db.collection("settings");
const [catSnap, orderSnap, subSnap] = await Promise.all(["categories", "categoryOrder", "subcategories"].map((id) => settings.doc(id).get()));
const cats = catSnap.data() || {};
const order = orderSnap.data()?.list || [];
const subs = subSnap.data() || {};

const newCats = {};
for (const [k, v] of Object.entries(cats)) newCats[k === "Apple Watch" ? "Watches" : k] = v;
for (const c of new Set(docs.map((d) => d.category))) if (!(c in newCats)) newCats[c] = "";
const newOrder = order.map((c) => (c === "Apple Watch" ? "Watches" : c));
for (const c of Object.keys(newCats)) if (!newOrder.includes(c)) newOrder.push(c);

const newSubs = { ...subs };
if (subs["Apple Watch"]) {
  newSubs.Watches = subs["Apple Watch"];
  delete newSubs["Apple Watch"];
}
const addSubs = {
  Watches: ["Galaxy Watch", "Smart Watches"],
  iPhones: ["iPhone X Series"],
  Samsung: ["Galaxy M Series"],
  "AirPods & Audio": ["JBL", "Galaxy Buds", "Mics"]
};
const added = [];
for (const [cat, names] of Object.entries(addSubs)) {
  const list = Array.isArray(newSubs[cat]) ? [...newSubs[cat]] : [];
  for (const name of names) {
    if (!list.some((s) => String(s.name).toLowerCase() === name.toLowerCase())) {
      list.push({ name, imageUrl: "" });
      added.push(`${cat} › ${name}`);
    }
  }
  newSubs[cat] = list;
}
console.log("Category rename:", "Apple Watch" in cats ? "Apple Watch → Watches (photo kept)" : "(none)");
console.log("New subcategories:", added.join(", ") || "(none)");

if (!WRITE) {
  console.log("\nDry run only. Re-run with --write to save.");
  process.exit(0);
}

// Products → batches of 400
for (let i = 0; i < docs.length; i += 400) {
  const batch = db.batch();
  for (const d of docs.slice(i, i + 400)) batch.set(db.collection("product").doc(d.id), d);
  await batch.commit();
}
// Move products still filed under "Apple Watch"
const oldWatch = await db.collection("product").where("category", "==", "Apple Watch").get();
if (!oldWatch.empty) {
  const batch = db.batch();
  oldWatch.docs.forEach((d) => batch.update(d.ref, { category: "Watches" }));
  await batch.commit();
}
const batch = db.batch();
batch.set(settings.doc("categories"), newCats);
batch.set(settings.doc("categoryOrder"), { list: newOrder });
batch.set(settings.doc("subcategories"), newSubs);
await batch.commit();
console.log(`\nSaved ${docs.length} products and updated categories.`);
process.exit(0);
