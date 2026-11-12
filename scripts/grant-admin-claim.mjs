/**
 * One-time: grant Firebase Auth custom claim admin:true for an email.
 *
 * Prereqs:
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key
 *   2. Save as Luxiva/firebase-service-account.json (never commit)
 *
 * Run from Luxiva/:
 *   node scripts/grant-admin-claim.mjs ssempijjadickson@gmail.com
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-admin-claim.mjs user@example.com");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keyPath = join(root, "firebase-service-account.json");

if (!existsSync(keyPath)) {
  console.error(`Missing ${keyPath}`);
  console.error("Download it from Firebase Console → bagz-5aec7 → Project settings → Service accounts → Generate new private key.");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const user = await admin.auth().getUserByEmail(email);
const claims = { ...(user.customClaims || {}), admin: true };
await admin.auth().setCustomUserClaims(user.uid, claims);
await admin.firestore().collection("admin").doc(user.uid).set({
  uid: user.uid,
  email: user.email || email
});

console.log(`Granted admin:true to ${user.email} (${user.uid}).`);
console.log("Sign out and sign in again in the admin app so the new token loads.");
process.exit(0);
