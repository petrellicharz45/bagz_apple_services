import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const keyPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../firebase-adminsdk.json");

export async function saveProductReport({ productId, productName, message }) {
  const text = String(message || "").trim();
  if (text.length < 5) throw new Error("Write what is wrong with this product.");
  if (!fs.existsSync(keyPath)) throw new Error("Reports are not configured.");
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), key.private_key).toString("base64url");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Could not save the report.");
  const id = `R${Date.now()}`;
  const fields = {
    productId: { stringValue: String(productId || "") },
    productName: { stringValue: String(productName || "").slice(0, 300) },
    message: { stringValue: text.slice(0, 2000) },
    createdAt: { timestampValue: new Date().toISOString() }
  };
  const saved = await fetch(
    `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID || "bagz-apple-services"}/databases/(default)/documents/productReport?documentId=${id}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    }
  );
  if (!saved.ok) throw new Error("Could not save the report.");
}
