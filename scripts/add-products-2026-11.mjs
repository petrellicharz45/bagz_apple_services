/**
 * Add the November 2026 price-list products (DJI Osmo, WHOOP/Fitbit, Hollyland mics, Apple Magic
 * accessories, AirTags/SmartTag, Apple Pencils) with their categories and subcategories.
 *
 *   node scripts/add-products-2026-11.mjs           (dry run: prints what would change)
 *   node scripts/add-products-2026-11.mjs --write   (saves to Firestore)
 *
 * - Products get fixed ids (bagz-…), so running it again updates them instead of making copies.
 *   A product already edited in the admin after it was added here is left alone.
 * - They are saved hidden with "Needs photo"; uploading a photo in the admin shows them in the shop.
 * - The existing "Samsung Galaxy Smart Tag" (wp-8265) only gets the new price.
 * Needs firebase-service-account.json in the project root (firebase-admin is loaded from functions/).
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = createRequire(join(root, "functions", "package.json"))("firebase-admin");
const WRITE = process.argv.includes("--write");

// ---------- catalogue ----------
const NEW_CATEGORY = { name: "Cameras & Gimbals", after: "AirPods & Audio" };

/** Subcategories to add (or whose search words change). */
const SUBS = {
  "Cameras & Gimbals": [{ name: "DJI Osmo", query: "osmo|dji" }],
  Watches: [{ name: "Fitness Trackers", query: "whoop|fitbit" }],
  "AirPods & Audio": [{ name: "Mics", query: "mic|hollyland" }],
  Accessories: [
    { name: "Magic Mouse & Keyboard", query: "magic mouse|magic keyboard" },
    { name: "Apple Pencil", query: "apple pencil" }
  ]
};

const HOOKS = {
  dji: "Redefining the art of content creation.",
  health: "Your health, your data, your edge.",
  mics: "Upgrade your audio, elevate your content.",
  magic: "Upgrade your setup with Apple Magic.",
  tags: "Track your essentials.",
  pencil: "Write, sketch, create! Bring every idea to life."
};

const PRODUCTS = [
  { id: "bagz-dji-osmo-pocket-3-creator-combo", name: "DJI Osmo Pocket 3 Creator Combo", category: "Cameras & Gimbals", price: 2_100_000, hook: "dji", what: "pocket gimbal camera" },
  { id: "bagz-dji-osmo-pocket-4-essential", name: "DJI Osmo Pocket 4 Essential", category: "Cameras & Gimbals", price: 2_200_000, hook: "dji", what: "pocket gimbal camera" },
  { id: "bagz-dji-osmo-pocket-4-standard", name: "DJI Osmo Pocket 4 Standard", category: "Cameras & Gimbals", price: 2_450_000, hook: "dji", what: "pocket gimbal camera" },

  { id: "bagz-whoop-peak", name: "WHOOP Peak", category: "Watches", price: 1_250_000, hook: "health", what: "health and fitness tracker" },
  { id: "bagz-google-fitbit-air", name: "Google Fitbit Air", category: "Watches", price: 900_000, hook: "health", what: "fitness tracker" },

  { id: "bagz-hollyland-lark-m2s-ultimate", name: "Hollyland Lark M2S Ultimate Wireless Microphone", category: "AirPods & Audio", price: 700_000, hook: "mics", what: "wireless microphone" },
  { id: "bagz-hollyland-lark-m2-lavalier", name: "Hollyland Lark M2 Wireless Lavalier Microphone", category: "AirPods & Audio", price: 650_000, hook: "mics", what: "wireless lavalier microphone" },
  { id: "bagz-hollyland-lark-a1-duo-usb-c", name: "Hollyland Lark A1 Duo USB-C Wireless Microphone", category: "AirPods & Audio", price: 450_000, hook: "mics", what: "USB-C wireless microphone" },

  { id: "bagz-apple-magic-mouse-usb-c", name: "Apple Magic Mouse (USB-C)", category: "Accessories", price: 650_000, hook: "magic", what: "Apple mouse" },
  { id: "bagz-apple-magic-mouse-lightning", name: "Apple Magic Mouse (Lightning)", category: "Accessories", price: 550_000, hook: "magic", what: "Apple mouse" },
  { id: "bagz-magic-keyboard-ipad-pro-11-m5", name: "Apple Magic Keyboard for iPad Pro 11-inch (M5)", category: "Accessories", price: 1_500_000, hook: "magic", what: "iPad Pro keyboard" },
  { id: "bagz-magic-keyboard-ipad-pro-13-m5", name: "Apple Magic Keyboard for iPad Pro 13-inch (M5)", category: "Accessories", price: 1_700_000, hook: "magic", what: "iPad Pro keyboard" },

  { id: "bagz-apple-airtag-4-pack", name: "Apple AirTag (4 Pack)", category: "Accessories", price: 600_000, hook: "tags", what: "item tracker" },
  { id: "bagz-apple-airtag-1-pack", name: "Apple AirTag (1 Pack)", category: "Accessories", price: 220_000, hook: "tags", what: "item tracker" },

  { id: "bagz-apple-pencil-pro", name: "Apple Pencil Pro", category: "Accessories", price: 700_000, hook: "pencil", what: "stylus for iPad" },
  { id: "bagz-apple-pencil-2nd-generation", name: "Apple Pencil (2nd Generation)", category: "Accessories", price: 600_000, hook: "pencil", what: "stylus for iPad" }
];

/** Existing products that only get a new price. */
const PRICE_UPDATES = [{ id: "wp-8265", name: "Samsung Galaxy Smart Tag", price: 200_000 }];

// ---------- helpers (same format as the imported products) ----------
const cut = (t, max) => (t.length <= max ? t : `${t.slice(0, max - 1).trim()}…`);
const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "product";
const ugx = (n) => `UGX ${n.toLocaleString("en-US")}`;

function productDoc(p, now, order) {
  const description =
    `Buy the authentic ${p.name} in Kampala at Bagz Apple Services. ${HOOKS[p.hook]}\n\n` +
    `Key Highlights:\n• 100% Authentic\n• ${p.what[0].toUpperCase()}${p.what.slice(1)}\n• Delivery: Same-Day Delivery in Kampala`;
  return {
    id: p.id,
    name: p.name,
    nameLowercase: p.name.toLowerCase(),
    category: p.category,
    price: p.price,
    offerPercentage: null,
    saleStartAt: null,
    saleEndAt: null,
    groups: ["Brand New"],
    createdAt: now - order * 1000, // list order = newest first
    description,
    sizes: null,
    colors: null,
    images: [],
    cardImage: null,
    stock: 5,
    sizeStock: {},
    special: false,
    hidden: true,
    hiddenReason: "no-photo",
    seoTitle: cut(`${p.name} Price in Uganda | Bagz Apple Services`, 70),
    seoDescription: cut(`Authentic ${p.name} at Bagz Apple Services in Kampala, Uganda. ${HOOKS[p.hook]} ${ugx(p.price)}.`, 155),
    seoKeywords: [p.name, p.category, `${p.name} price in Uganda`, "Kampala", "Bagz Apple Services", "buy online Uganda"].join(", "),
    slug: slugify(p.name),
    source: "bagz-pricelist-2026-11",
    importedAt: now,
    deliveryEstimateDays: 0,
    deliveryEstimateLabel: "Same-day in Kampala",
    deliveryStartAt: null,
    deliveryEndAt: null
  };
}

// ---------- run ----------
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, "firebase-service-account.json"), "utf8")))
});
const db = admin.firestore();
const settings = db.collection("settings");
const now = Date.now();

const [catSnap, orderSnap, subSnap] = await Promise.all(
  ["categories", "categoryOrder", "subcategories"].map((id) => settings.doc(id).get())
);
const cats = catSnap.data() || {};
const order = orderSnap.data()?.list || [];
const subs = subSnap.data() || {};

// Backup of everything this script may change
const ids = [...PRODUCTS.map((p) => p.id), ...PRICE_UPDATES.map((p) => p.id)];
const before = Object.fromEntries(
  (await Promise.all(ids.map((id) => db.collection("product").doc(id).get()))).map((d) => [d.id, d.exists ? d.data() : null])
);
const backupPath = join(root, `.products-backup-${now}.json`);
writeFileSync(backupPath, JSON.stringify({ categories: cats, categoryOrder: order, subcategories: subs, products: before }, null, 2));

// Categories
const newCats = { ...cats };
const newOrder = [...order];
if (!(NEW_CATEGORY.name in newCats)) newCats[NEW_CATEGORY.name] = "";
if (!newOrder.includes(NEW_CATEGORY.name)) {
  const at = newOrder.indexOf(NEW_CATEGORY.after);
  newOrder.splice(at >= 0 ? at + 1 : newOrder.length, 0, NEW_CATEGORY.name);
}

// Subcategories (photos already set are kept)
const newSubs = { ...subs };
const subChanges = [];
for (const [cat, list] of Object.entries(SUBS)) {
  const current = Array.isArray(newSubs[cat]) ? newSubs[cat].map((s) => ({ ...s })) : [];
  for (const { name, query } of list) {
    const hit = current.find((s) => String(s.name).toLowerCase() === name.toLowerCase());
    if (!hit) {
      current.push({ name, imageUrl: "", query });
      subChanges.push(`+ ${cat} › ${name}  [${query}]`);
    } else if (hit.query !== query) {
      subChanges.push(`~ ${cat} › ${name}  [${hit.query || "-"}] → [${query}]`);
      hit.query = query;
    }
  }
  newSubs[cat] = current;
}

// Products
const toWrite = [];
const skipped = [];
PRODUCTS.forEach((p, i) => {
  const prev = before[p.id];
  if (prev && prev.updatedAt && prev.importedAt && prev.updatedAt > prev.importedAt) {
    skipped.push(`${p.name} (edited in the admin)`);
    return;
  }
  const d = productDoc(p, now, i);
  if (prev?.createdAt) d.createdAt = prev.createdAt;
  toWrite.push(d);
});
const priceChanges = PRICE_UPDATES.filter((u) => before[u.id]).map((u) => ({ ...u, old: before[u.id].price }));

console.log("Category:", NEW_CATEGORY.name in cats ? `${NEW_CATEGORY.name} (already there)` : `+ ${NEW_CATEGORY.name}`);
console.log("Category order:", newOrder.join(" → "));
console.log("Subcategories:\n  " + (subChanges.join("\n  ") || "(no change)"));
console.table(toWrite.map((d) => ({ name: d.name, category: d.category, price: ugx(d.price), new: before[d.id] ? "update" : "new" })));
for (const u of priceChanges) console.log(`Price: ${u.name}  ${ugx(u.old)} → ${ugx(u.price)}`);
if (skipped.length) console.log("Skipped:", skipped.join("; "));
console.log("Backup:", backupPath);

if (!WRITE) {
  console.log("\nDry run only. Re-run with --write to save.");
  process.exit(0);
}

const batch = db.batch();
for (const d of toWrite) batch.set(db.collection("product").doc(d.id), d);
for (const u of priceChanges) batch.update(db.collection("product").doc(u.id), { price: u.price, updatedAt: now });
batch.set(settings.doc("categories"), newCats);
batch.set(settings.doc("categoryOrder"), { list: newOrder }, { merge: true });
batch.set(settings.doc("subcategories"), newSubs);
await batch.commit();
console.log(`\nSaved ${toWrite.length} products, ${priceChanges.length} price change(s), categories and subcategories.`);
process.exit(0);
