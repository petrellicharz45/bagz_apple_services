import { initiateMoMoPayment, newOrderId } from "./payment.js";
import { creditWallet } from "./wallet.js";
import { detectMobileNetwork } from "./momoNetwork.js";

export const WALLET_TOPUP_PIN_MS = 2800;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Top up wallet only after mobile money payment succeeds (user enters PIN on phone).
 * Does not credit on pending/unconfirmed payments.
 */
export async function processWalletTopUp({ amount, phone, method }) {
  const add = Math.round(Number(amount) || 0);
  if (add < 1000) {
    throw new Error("Minimum top-up is UGX 1,000.");
  }
  if (method === "card") {
    throw new Error("Card top-up is coming soon. Use MTN or Airtel Money.");
  }

  const normalizedPhone = String(phone || "").trim();
  if (normalizedPhone.length < 9) {
    throw new Error("Enter your payment phone number.");
  }

  const network = detectMobileNetwork(normalizedPhone);
  if (!network) {
    throw new Error("Use a valid MTN (077…) or Airtel (070/075…) Uganda number.");
  }
  if (method === "mtn" && network !== "mtn") {
    throw new Error("This number is not MTN. Choose Airtel Money or enter an MTN number.");
  }
  if (method === "airtel" && network !== "airtel") {
    throw new Error("This number is not Airtel. Choose MTN Mobile Money or enter an Airtel number.");
  }

  const topUpId = `TOPUP-${newOrderId()}`;
  const started = Date.now();

  const result = await initiateMoMoPayment({
    phone: normalizedPhone,
    amount: add,
    orderId: topUpId,
    network,
    items: [{ id: "wallet_topup", name: "Wallet top-up", qty: 1, price: add }]
  });

  const elapsed = Date.now() - started;
  if (elapsed < WALLET_TOPUP_PIN_MS) {
    await sleep(WALLET_TOPUP_PIN_MS - elapsed);
  }

  if (result.ok) {
    creditWallet(add, {
      type: "top_up",
      method: network,
      note: `Mobile money top-up confirmed (${topUpId})`
    });
    return {
      ok: true,
      message: `Payment confirmed. ${add.toLocaleString()} UGX added to your wallet.`
    };
  }

  if (result.pending) {
    return {
      ok: false,
      pending: true,
      message:
        result.message ||
        "Check your phone and enter your payment PIN. Your wallet balance will update only after the payment is confirmed."
    };
  }

  throw new Error(result.message || "Top-up payment was not completed.");
}
