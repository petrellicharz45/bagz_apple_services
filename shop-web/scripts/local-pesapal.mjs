import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../functions/.env");

function readEnv(name) {
  const text = fs.readFileSync(envPath, "utf8");
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
  if (!line) throw new Error(`Missing ${name}`);
  let value = line.slice(name.length + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function pesapalBase() {
  return readEnv("PESAPAL_ENVIRONMENT").toLowerCase() === "production"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";
}

async function pesapal(pathname, token, body) {
  const res = await fetch(`${pesapalBase()}${pathname}`, {
    method: body ? "POST" : "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Pesapal request failed (${res.status})`);
  }
  return data;
}

let ipnId = "";
const keyPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../firebase-adminsdk.json");

function fsValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "number") return { integerValue: String(Math.round(value)) };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  if (typeof value === "object") {
    const fields = {};
    for (const [key, item] of Object.entries(value)) fields[key] = fsValue(item);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function recordOrder(order, paymentStatus, orderStatus) {
  const id = String(order.orderId || "").trim();
  if (!id || !fs.existsSync(keyPath)) return;
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
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15000)
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return;
  const addressText = String(order.address || "");
  const fields = {
    orderId: Number(id.split("-")[1]) || Date.now(),
    orderStatus,
    paymentStatus,
    webPaymentReported: paymentStatus,
    walletApplied: Math.max(0, Math.round(Number(order.walletApplied) || 0)),
    totalPrice: Math.max(0, Math.round(Number(order.amount) || Number(order.total) || 0)),
    products: Array.isArray(order.items)
      ? order.items.map((item) => ({
          product: { id: item.id || "", name: item.name || "", images: item.imageUrl ? [item.imageUrl] : [] },
          quantity: item.qty || 1,
          selectedSize: item.size || "",
          selectedColorName: item.color || ""
        }))
      : [],
    address: {
      label: "Website",
      address: addressText,
      city: /kampala/i.test(addressText) ? "Kampala" : addressText.split(",")[0].trim(),
      phone: String(order.phone || "")
    },
    customerName: String(order.name || ""),
    customerPhone: String(order.phone || ""),
    currency: "UGX",
    userId: "",
    source: "shop-web",
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    timestamp: new Date().toISOString()
  };
  const names = Object.keys(fields);
  const mask = names.map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join("&");
  const saved = await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID || "bagz-apple-services"}/databases/(default)/documents/order/${encodeURIComponent(id)}?${mask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(names.map((name) => [name, name === "timestamp" ? { timestampValue: fields.timestamp } : fsValue(fields[name])])) }),
    signal: AbortSignal.timeout(15000)
  });
  if (!saved.ok) {
    const detail = await saved.text();
    throw new Error(`Order was not saved (${saved.status}) ${detail.slice(0, 180)}`);
  }
}

export async function localPesapalRedirect({ orderId, amount, name, phone, address, total, walletApplied, items }) {
  const id = String(orderId || "").trim();
  const due = Math.round(Number(amount) || 0);
  const record = { orderId: id, amount: due, name, phone, address, total, walletApplied, items };
  if (!/^FD-\d{10,15}-[a-z0-9]{3,10}$/.test(id)) throw new Error("Invalid order.");
  if (due < 1) throw new Error("Nothing to pay.");
  await recordOrder(record, "pending_payment", "Pending");

  try {
  const tokenData = await pesapal("/api/Auth/RequestToken", "", {
    consumer_key: readEnv("PESAPAL_CONSUMER_KEY"),
    consumer_secret: readEnv("PESAPAL_CONSUMER_SECRET")
  });
  const token = tokenData.token;
  if (!token) throw new Error(tokenData.message || "Pesapal did not sign in.");

  if (!ipnId) {
    const list = await pesapal("/api/URLSetup/GetIpnList", token);
    const existing = Array.isArray(list) ? list[0] : list?.ipn_list?.[0];
    ipnId = existing?.ipn_id || existing?.ipnId || "";
  }
  if (!ipnId) {
    const registered = await pesapal("/api/URLSetup/RegisterIPN", token, {
      url: "https://bagzappleservices.com/pesapal-ipn",
      ipn_notification_type: "GET"
    });
    ipnId = registered.ipn_id || "";
  }
  if (!ipnId) throw new Error("Pesapal did not accept the notification address.");

  const parts = String(name || "Customer").trim().split(/\s+/).filter(Boolean);
  const submitted = await pesapal("/api/Transactions/SubmitOrderRequest", token, {
    id,
    currency: "UGX",
    amount: due,
    description: `Bagz ${id}`,
    callback_url: "https://bagzappleservices.com/",
    notification_id: ipnId,
    billing_address: {
      email_address: "info@bagzappleservices.com",
      phone_number: String(phone || "").replace(/\s/g, "") || "0700000000",
      country_code: "UG",
      first_name: parts[0] || "Customer",
      last_name: parts.slice(1).join(" ") || "Deals"
    }
  });
  if (!submitted.redirect_url) {
    const detail = submitted?.error?.message || submitted?.error?.code || submitted?.message;
    throw new Error(detail || "Pesapal did not return a payment page.");
  }
  await recordOrder(record, "pending_payment", "Pending");
  return submitted.redirect_url;
  } catch (error) {
    await recordOrder(record, "failed", "Failed").catch(() => {});
    const cause = error?.cause?.code || error?.cause?.message || "";
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    const message = timedOut
      ? "Pesapal took too long. Try again."
      : error.message === "fetch failed"
        ? `Could not reach Pesapal${cause ? ` (${cause})` : ""}.`
        : error.message;
    throw new Error(message);
  }
}
