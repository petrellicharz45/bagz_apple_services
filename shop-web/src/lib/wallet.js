import { writable, get } from "svelte/store";
import { db } from "./firebase.js";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { readProfile } from "./accountStore.js";

const WALLET_KEY = "fancydeals_wallet_v1";
const TX_KEY = "fancydeals_wallet_tx_v1";
const MAX_TX = 80;

function readLocalBalance() {
  try {
    const n = Number(JSON.parse(localStorage.getItem(WALLET_KEY) || "0"));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

function writeLocalBalance(amount) {
  const v = Math.max(0, Math.round(amount));
  localStorage.setItem(WALLET_KEY, JSON.stringify(v));
  walletBalanceStore.set(v);
  return v;
}

export const walletBalanceStore = writable(readLocalBalance());

export function getWalletBalance() {
  return get(walletBalanceStore);
}

export function readWalletTransactions() {
  try {
    return JSON.parse(localStorage.getItem(TX_KEY) || "[]");
  } catch {
    return [];
  }
}

function pushTransaction(entry) {
  const list = readWalletTransactions();
  list.unshift({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    ...entry
  });
  localStorage.setItem(TX_KEY, JSON.stringify(list.slice(0, MAX_TX)));
}

/**
 * Credit wallet (refunds, rewards, admin, top-up).
 */
export function creditWallet(amount, meta = {}) {
  const add = Math.round(Number(amount) || 0);
  if (add <= 0) return getWalletBalance();
  const next = writeLocalBalance(getWalletBalance() + add);
  pushTransaction({
    type: meta.type || "credit",
    amount: add,
    balanceAfter: next,
    note: meta.note || "Credit",
    orderId: meta.orderId || null,
    method: meta.method || null
  });
  return next;
}

/**
 * Debit wallet for purchases.
 */
export function debitWallet(amount, meta = {}) {
  const sub = Math.round(Number(amount) || 0);
  if (sub <= 0) return getWalletBalance();
  const current = getWalletBalance();
  const use = Math.min(current, sub);
  if (use <= 0) return current;
  const next = writeLocalBalance(current - use);
  pushTransaction({
    type: meta.type || "debit_purchase",
    amount: -use,
    balanceAfter: next,
    note: meta.note || "Order payment",
    orderId: meta.orderId || null
  });
  return next;
}

/** @deprecated Use processWalletTopUp — credits only after mobile money confirms. */
export function topUpWallet() {
  throw new Error("Use mobile money top-up from the wallet page (PIN required).");
}

/** Apply refund when order return / out-of-stock approved. */
export function creditRefund(orderId, amount, reason = "Refund approved") {
  return creditWallet(amount, {
    type: "refund",
    orderId,
    note: reason
  });
}

export function walletAmountForOrder(total) {
  const balance = getWalletBalance();
  const t = Math.round(Number(total) || 0);
  const applied = Math.min(balance, t);
  return { applied, due: t - applied, balance };
}

/**
 * Pull balance from Firestore when profile email matches a user doc (admin credits / app account).
 * Requires that user to be signed in on web in future; best-effort for matching email today.
 */
export async function syncWalletFromCloud() {
  const email = readProfile().email?.trim().toLowerCase();
  if (!email || !db) return getWalletBalance();
  try {
    const q = query(collection(db, "user"), where("email", "==", email), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return getWalletBalance();
    const remote = Math.round(Number(snap.docs[0].data().walletBalance) || 0);
    const local = getWalletBalance();
    if (remote > local) {
      creditWallet(remote - local, { type: "sync", note: "Credited from Fancy Deals account" });
    } else if (remote !== local) {
      writeLocalBalance(remote);
    }
  } catch {
    /* guest / rules — keep local balance */
  }
  return getWalletBalance();
}

export function formatTxType(type) {
  const map = {
    credit: "Credit",
    refund: "Refund",
    top_up: "Top-up",
    debit_purchase: "Purchase",
    sync: "Account sync"
  };
  return map[type] || type;
}
