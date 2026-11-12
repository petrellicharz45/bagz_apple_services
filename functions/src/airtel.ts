import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Airtel Money (Uganda) — prepared for direct API credentials.
 * Wire collection + callback here when the owner provides Airtel Money API access.
 */
export async function executeAirtelOrder(
  orderId: string,
  userId: string,
  userEmail: string,
  phone: string,
  customConfig?: {
    clientId?: string;
    clientSecret?: string;
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
    !!(customConfig?.clientId && customConfig?.clientSecret) ||
    !!(process.env.AIRTEL_CLIENT_ID && process.env.AIRTEL_CLIENT_SECRET);

  await orderRef.set(
    {
      paymentProvider: "airtel",
      paymentNetwork: "airtel",
      customerPhone: phone || order.customerPhone || order.mobileMoneyNumber || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  if (!configured) {
    return {
      status: "not_configured",
      provider: "airtel",
      message:
        "Airtel Money API is prepared but credentials are not configured yet. Order saved as pending payment."
    };
  }

  // TODO: Call Airtel Money collection when credentials are live.
  void userEmail;
  throw new HttpsError(
    "failed-precondition",
    "Airtel Money API credentials are present but live collection is not wired yet."
  );
}
