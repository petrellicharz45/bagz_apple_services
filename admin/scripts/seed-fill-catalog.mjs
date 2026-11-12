/**
 * Add sample products per category + audience groups (does not delete existing catalog).
 *
 *   set SEED_PASSWORD=your_firebase_password
 *   node scripts/seed-fill-catalog.mjs
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
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

const img = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=800&q=80`;

const CATEGORY_IMAGES = {
  Clothing: img("1483985988355-763728e1935b"),
  Shoes: img("1549298916-b41d501d3772"),
  Accessories: img("1572635196237-14b3e281a0b3"),
  Bags: img("1584916201218-f4242ceb4809"),
  Jewelry: img("1515562141203-7a88fb7ce338"),
  Beauty: img("1596462502278-27bfdc403348"),
  Recommended: img("1553062407-98eeb64c6a62")
};

/** @type {Array<{name:string,category:string,price:number,offer?:number,groups:string[],special?:boolean,image:string}>} */
const FILL = [
  { name: "Men's Oxford Dress Shirt", category: "Clothing", price: 85000, offer: 15, groups: ["Men"], image: img("1596755094514-f87eefee715b") },
  { name: "Men's Slim Chino Pants", category: "Clothing", price: 72000, groups: ["Men"], image: img("1473968662648-7eae829c45e7") },
  { name: "Kids School Backpack", category: "Bags", price: 55000, groups: ["Kids"], image: img("1553062407-98eeb64c6a62") },
  { name: "Kids Graphic Tee 2-Pack", category: "Clothing", price: 28000, groups: ["Kids"], image: img("1503342217505-9d6a7b0950f3") },
  { name: "Home LED Desk Lamp", category: "Accessories", price: 45000, groups: ["Home Utilities"], image: img("1507473886341-1895317952f1") },
  { name: "Kitchen Storage Set 5pc", category: "Accessories", price: 38000, groups: ["Home Utilities"], image: img("1556911220-e15b29be8c8f") },
  { name: "Sterling Hoop Earrings", category: "Jewelry", price: 22000, offer: 10, groups: ["Women"], image: img("1535632066927-ab7c9ab60908") },
  { name: "Layered Gold Necklace", category: "Jewelry", price: 35000, groups: ["Women"], image: img("1599643478524-fb66f7f2b1d6") },
  { name: "Leather Crossbody Bag", category: "Bags", price: 98000, groups: ["Women"], image: img("1548036328-c9fa89d128fa") },
  { name: "Women's Running Shoes", category: "Shoes", price: 125000, offer: 20, groups: ["Women"], image: img("1606107557195-0f29cb4f3bcd") },
  { name: "Men's Sport Trainers", category: "Shoes", price: 110000, groups: ["Men"], image: img("1542291026-7eec264c27ff") },
  { name: "UV Protection Sunglasses", category: "Accessories", price: 32000, groups: ["Men", "Women"], image: img("1572635196237-14b3e281a0b3") },
  { name: "Hydrating Face Serum", category: "Beauty", price: 42000, groups: ["Women", "Beauty"], image: img("1620916566398-39f1144abb7d") },
  { name: "Men's Grooming Kit", category: "Beauty", price: 48000, groups: ["Men", "Beauty"], image: img("1596462502278-27bfdc403348") },
  {
    name: "Featured Deal — Travel Bag",
    category: "Bags",
    price: 89000,
    offer: 30,
    groups: ["Women"],
    special: true,
    image: img("1553062407-98eeb64c6a62")
  },
  { name: "Women's Linen Midi Dress", category: "Clothing", price: 72000, offer: 18, groups: ["Women"], image: img("1595777453373-55b39a4d4b6f") },
  { name: "Casual Cotton T-Shirt 2-Pack", category: "Clothing", price: 35000, offer: 12, groups: ["Women", "Men"], image: img("1521572163474-6864f9cf17ab") },
  { name: "High-Waist Yoga Leggings", category: "Clothing", price: 42000, groups: ["Women"], image: img("1506629083125-a959a745b2fd") },
  { name: "Men's Denim Jacket", category: "Clothing", price: 95000, offer: 22, groups: ["Men"], image: img("1576995853123-679a1d022cd7") },
  { name: "Ankle Boots — Brown", category: "Shoes", price: 145000, offer: 35, groups: ["Women"], image: img("1543163521-1bf539c55dd2") },
  { name: "Pearl Drop Earrings", category: "Jewelry", price: 28000, offer: 15, groups: ["Women"], image: img("1535632066927-ab7c9ab60908") },
  { name: "Canvas Tote — Striped", category: "Bags", price: 38000, groups: ["Women", "Accessories"], image: img("1590874101128-1e0654b7203a") },
  { name: "Wireless Earbuds Case", category: "Accessories", price: 18000, offer: 10, groups: ["Men", "Women"], image: img("1606220588913-b3aac4c2f547") },
  { name: "Matte Lipstick Trio", category: "Beauty", price: 24000, offer: 25, groups: ["Women", "Beauty"], image: img("1586495777744-44168d6d9293") },
  { name: "Classic Leather Belt", category: "Accessories", price: 29000, groups: ["Men"], image: img("1624222247344-550fb60583fd") },
  { name: "Kids Running Shoes", category: "Shoes", price: 65000, offer: 15, groups: ["Kids"], image: img("1608232642954-907aeed6dfd4") },
  { name: "Office Laptop Backpack", category: "Bags", price: 82000, offer: 18, groups: ["Men", "Women"], image: img("1622560480605-d83c853bcbdf") },
  { name: "Silver Chain Bracelet", category: "Jewelry", price: 19000, groups: ["Women"], image: img("1611591437281-63f3a398544b") },
  { name: "Summer Floral Dress", category: "Clothing", price: 58000, offer: 20, groups: ["Women"], image: img("1496747614446-174239f131d9") },
  { name: "Men's Polo Shirt", category: "Clothing", price: 44000, groups: ["Men"], image: img("1622445265618-44c9a3d3a7a2") },
  { name: "Slip-On Canvas Shoes", category: "Shoes", price: 52000, offer: 12, groups: ["Women", "Men"], image: img("1549298916-b41d501d3772") }
];

const app = initializeApp(destConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  await signInWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "settings", "categories"), CATEGORY_IMAGES, { merge: true });
  console.log("Updated settings/categories with image URLs (merge).");

  const now = Date.now();
  const saleEnd = now + 21 * 24 * 60 * 60 * 1000;

  for (const p of FILL) {
    const id = randomUUID();
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
      description: `${p.name} — sample listing. Edit or replace in Admin.`,
      sizes: p.category === "Shoes" ? ["40", "41", "42", "43"] : p.category === "Clothing" ? ["S", "M", "L", "XL"] : null,
      colors: null,
      images: [p.image],
      cardImage: p.image,
      stock: 20,
      sizeStock: {},
      special: !!p.special,
      createdAt: now
    });
    console.log("Added:", p.name, `(${p.category}, groups: ${p.groups.join(", ")})`);
  }

  console.log(`Done. Added ${FILL.length} products. Refresh the shop (Ctrl+Shift+R).`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
