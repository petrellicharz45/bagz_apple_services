import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * MTN Mobile Money (Uganda) — prepared for direct API credentials.
 * Wire collection + webhook here when the owner provides MTN MoMo API access.
 */
export async function executeMtnOrder(
  orderId: string,
  userId: string,
  userEmail: string,
  phone: string,
  customConfig?: {
    apiUser?: string;
    apiKey?: string;
    subscriptionKey?: string;
    environment?: string;
  }
) {
  const orderRef = admin.firestore().collection("order").doc(orderId.toString());
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new HttpsError("not-found", `Order ${orderId} was not found.`);
  }
  const order = orderDoc.data();
  if (!order || order.userId !== userId) {
    throw new HttpsError("permission-denied", "You cannot pay for this order.");
  }

  const configured =
    !!(customConfig?.apiUser && customConfig?.apiKey && customConfig?.subscriptionKey) ||
    !!(process.env.MTN_API_USER && process.env.MTN_API_KEY && process.env.MTN_SUBSCRIPTION_KEY);

  await orderRef.set(
    {
      paymentProvider: "mtn",
      paymentNetwork: "mtn",
      customerPhone: phone || order.customerPhone || order.mobileMoneyNumber || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  if (!configured) {
    return {
      status: "not_configured",
      provider: "mtn",
      message:
        "MTN Mobile Money API is prepared but credentials are not configured yet. Order saved as pending payment."
    };
  }

  // TODO: Call MTN Collection RequestToPay when credentials are live.
  void userEmail;
  throw new HttpsError(
    "failed-precondition",
    "MTN Mobile Money API credentials are present but live collection is not wired yet."
  );
}
