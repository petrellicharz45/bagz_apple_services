/**
 * Seed demo products into fancydeals-ug (no luxiva access needed).
 *   set SEED_PASSWORD=your_fancydeals_login_password
 *   node scripts/seed-dummy-products.mjs
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDocs, collection } from "firebase/firestore";
import { randomUUID } from "crypto";

// Firebase web config comes from env (admin/.env) — never hardcode a client's project here.
const destConfig = {
  apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.PUBLIC_FIREBASE_APP_ID
};
if (!destConfig.apiKey || !destConfig.projectId) {
  console.error("Set PUBLIC_FIREBASE_* env vars (see admin/.env.example) before running this script.");
  process.exit(1);
}

const email = process.env.SEED_EMAIL?.trim() || "ssempijjadickson@gmail.com";
const password = process.env.SEED_PASSWORD;
if (!password) {
  console.error("Set SEED_PASSWORD (Firebase password for fancydeals-ug).");
  process.exit(1);
}

const img = (seed) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=800&q=80`;

const DUMMY = [
  {
    name: "MAANGE Foundation Set",
    category: "Beauty",
    price: 50000,
    offer: 48,
    groups: ["Women", "Beauty"],
    stock: 25,
    image: img("1596462502279-4a424a4937b2")
  },
  {
    name: "Ladies Butterfly Earrings",
    category: "Jewelry",
    price: 20000,
    offer: 20,
    groups: ["Women", "Accessories"],
    stock: 40,
    image: img("1535632066927-ab7c754ab398")
  },
  {
    name: "Velvet Matte Lipstick 5pc Set",
    category: "Beauty",
    price: 30000,
    offer: 50,
    groups: ["Women", "Beauty"],
    stock: 30,
    image: img("1586495777744-441de9a37a8b")
  },
  {
    name: "Women Pattern Shirt & Trousers",
    category: "Clothing",
    price: 120000,
    offer: 50,
    groups: ["Women"],
    stock: 15,
    sizes: ["S", "M", "L", "XL"],
    image: img("1515886657617-9f3515b0c78f")
  },
  {
    name: "Classic Aviator Sunglasses",
    category: "Accessories",
    price: 45000,
    offer: 15,
    groups: ["Men", "Women", "Accessories"],
    stock: 20,
    image: img("1572635196237-14b490b24b2a")
  },
  {
    name: "Cozy Knit Beanie",
    category: "Clothing",
    price: 25000,
    offer: 10,
    groups: ["Women", "Men"],
    stock: 35,
    image: img("1521369909029-2afed882baee")
  },
  {
    name: "Men Leather Casual Shoes",
    category: "Shoes",
    price: 180000,
    offer: 25,
    groups: ["Men"],
    stock: 12,
    sizes: ["40", "41", "42", "43", "44"],
    image: img("1549297750-d14e24c6d0cb")
  },
  {
    name: "Everyday Tote Bag",
    category: "Bags",
    price: 65000,
    offer: 0,
    groups: ["Women", "Accessories"],
    stock: 18,
    image: img("1553062407-98eeb64c6a62")
  }
];

const app = initializeApp(destConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  await signInWithEmailAndPassword(auth, email, password);

  const existing = await getDocs(collection(db, "product"));
  if (existing.size > 0) {
    console.log(`Already ${existing.size} products — skipping seed.`);
    return;
  }

  const categories = {
    Clothing: true,
    Shoes: true,
    Accessories: true,
    Bags: true,
    Jewelry: true,
    Beauty: true
  };
  await setDoc(doc(db, "settings", "categories"), categories, { merge: true });

  const now = Date.now();
  const saleEnd = now + 14 * 24 * 60 * 60 * 1000;

  for (const p of DUMMY) {
    const id = randomUUID();
    const url = p.image;
    const offer = p.offer > 0 ? p.offer : null;
    await setDoc(doc(db, "product", id), {
      id,
      name: p.name,
      nameLowercase: p.name.toLowerCase(),
      category: p.category,
      price: p.price,
      offerPercentage: offer,
      saleStartAt: offer ? now : null,
      saleEndAt: offer ? saleEnd : null,
      groups: p.groups,
      description: "Demo product — replace with real catalog when migration is done.",
      sizes: p.sizes ?? null,
      colors: null,
      images: [url],
      cardImage: url,
      stock: p.stock,
      sizeStock: {},
      special: false,
      createdAt: now
    });
    console.log("Added:", p.name);
  }

  console.log(`Done. ${DUMMY.length} demo products in fancydeals-ug.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
