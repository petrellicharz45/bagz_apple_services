// Run with: npx firebase-tools@14 emulators:exec --only firestore --project demo-bagz "node shop-web/scripts/test-cod-rules.mjs"
// Checks firestore.rules for website cash-on-delivery orders against the local emulator.
import { initializeApp } from "firebase/app";
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, serverTimestamp
} from "firebase/firestore";

const app = initializeApp({ projectId: "demo-bagz", apiKey: "demo" });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", Number(process.env.FS_PORT || 8080));

const id = `FD-${Date.now()}-abc123`;
const good = () => ({
  orderId: Date.now(), orderStatus: "Pending", paymentStatus: "cash_on_delivery",
  paymentMethod: "Cash on delivery", totalPrice: 4500000, itemsSubtotal: 4500000,
  products: [{ product: { id: "wp-1", name: "iPhone 16", category: "iPhones", price: 4500000, images: [] }, quantity: 1 }],
  address: { label: "Website", address: "Ntinda, Kampala", phone: "0772123456" },
  customerName: "Test Buyer", customerPhone: "0772123456", customerEmail: "", currency: "UGX",
  userId: "", source: "shop-web", stockDeducted: false, clientPriced: true, note: "",
  date: "14 Nov 2026", timestamp: serverTimestamp()
});

let failures = 0;
async function expect(label, shouldPass, fn) {
  try {
    await fn();
    console.log(shouldPass ? "PASS" : "FAIL", label, shouldPass ? "" : "(was allowed!)");
    if (!shouldPass) failures++;
  } catch (e) {
    console.log(shouldPass ? "FAIL" : "PASS", label, shouldPass ? e.code : "(refused)");
    if (shouldPass) failures++;
  }
}

await expect("guest creates a valid COD order", true, () => setDoc(doc(db, "order", id), good()));
await expect("guest cannot read the order", false, () => getDoc(doc(db, "order", id)));
await expect("guest cannot overwrite it", false, () => setDoc(doc(db, "order", id), good()));
await expect("guest cannot mark it paid", false, () => updateDoc(doc(db, "order", id), { paymentStatus: "paid" }));
await expect("cannot create as already paid", false, () =>
  setDoc(doc(db, "order", `FD-${Date.now()}-paid01`), { ...good(), paymentStatus: "paid" }));
await expect("cannot create as Confirmed", false, () =>
  setDoc(doc(db, "order", `FD-${Date.now()}-conf01`), { ...good(), orderStatus: "Confirmed" }));
await expect("cannot add unknown fields", false, () =>
  setDoc(doc(db, "order", `FD-${Date.now()}-xtra01`), { ...good(), isPaid: true }));
await expect("cannot use a made-up order id", false, () => setDoc(doc(db, "order", "hacked"), good()));
await expect("cannot leave out the phone", false, () =>
  setDoc(doc(db, "order", `FD-${Date.now()}-noph01`), { ...good(), customerPhone: "" }));
await expect("cannot claim another user's id", false, () =>
  setDoc(doc(db, "order", `FD-${Date.now()}-user01`), { ...good(), userId: "someoneElse" }));

console.log(failures ? `${failures} check(s) failed` : "All rule checks passed");
process.exit(failures ? 1 : 0);
