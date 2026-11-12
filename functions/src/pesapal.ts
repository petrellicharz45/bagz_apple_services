import * as admin from 'firebase-admin';
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import axios from 'axios';

// ----------------------------------------------------------------------
// Helper: Resolve Pesapal Configuration
// ----------------------------------------------------------------------
export interface PesapalConfig {
  consumerKey: string;
  consumerSecret: string;
  baseUrl: string;
  isProduction: boolean;
}

export function resolvePesapalConfig(customConfig?: {
  consumerKey?: string;
  consumerSecret?: string;
  environment?: string;
}): PesapalConfig {
  const consumerKey =
    customConfig?.consumerKey ||
    process.env.PESAPAL_CONSUMER_KEY ||
    "SQFaQXzZzeO9k1gyMbjZEZwaZ5pA2Vrl"; // Default sandbox fallback
  const consumerSecret =
    customConfig?.consumerSecret ||
    process.env.PESAPAL_CONSUMER_SECRET ||
    "2UZyyyvGpY+UkGhBaCiGwWXF0fc="; // Default sandbox fallback
  const environment =
    customConfig?.environment ||
    process.env.PESAPAL_ENVIRONMENT ||
    "sandbox";

  const isProduction = environment.toLowerCase() === "production";
  const baseUrl = isProduction
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";

  return { consumerKey, consumerSecret, baseUrl, isProduction };
}

// ----------------------------------------------------------------------
// Helper: Authenticate with Pesapal to fetch JWT Token
// ----------------------------------------------------------------------
export async function getPesapalToken(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<string> {
  try {
    console.log("Pesapal: Fetching Auth Token from", `${baseUrl}/api/Auth/RequestToken`);
    const response = await axios.post(
      `${baseUrl}/api/Auth/RequestToken`,
      {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        }
      }
    );

    if (response.data && response.data.token) {
      console.log("Pesapal: Auth Token successfully fetched");
      return response.data.token;
    } else {
      throw new Error(response.data?.message || "Invalid token response structure.");
    }
  } catch (error: any) {
    console.error("Pesapal: Authentication request failed:", error.response?.data || error.message);
    throw new Error("Pesapal authentication failed: " + (error.response?.data?.message || error.message));
  }
}

// ----------------------------------------------------------------------
// Helper: Get or Register IPN URL
// ----------------------------------------------------------------------
export async function getOrRegisterIpnId(
  baseUrl: string,
  token: string,
  projectId: string,
  region: string
): Promise<string> {
  const ipnRef = admin.firestore().collection("settings").doc("pesapal_ipn");
  const ipnDoc = await ipnRef.get();

  if (ipnDoc.exists) {
    const cachedData = ipnDoc.data();
    if (cachedData && cachedData.ipnId) {
      console.log("Pesapal: Using cached IPN ID:", cachedData.ipnId);
      return cachedData.ipnId;
    }
  }

  const webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/pesapalIpn`;
  console.log("Pesapal: Registering new webhook IPN URL:", webhookUrl);

  try {
    const response = await axios.post(
      `${baseUrl}/api/URLSetup/RegisterIPN`,
      {
        url: webhookUrl,
        ipn_notification_type: "GET"
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.ipn_id) {
      const ipnId = response.data.ipn_id;
      console.log("Pesapal: Successfully registered IPN URL. Received IPN ID:", ipnId);

      await ipnRef.set({
        ipnId: ipnId,
        url: webhookUrl,
        registeredAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return ipnId;
    } else {
      throw new Error(response.data?.message || "Failed to register IPN with Pesapal.");
    }
  } catch (error: any) {
    console.error("Pesapal: IPN registration failed:", error.response?.data || error.message);
    throw new Error("Failed to register IPN: " + (error.response?.data?.message || error.message));
  }
}

// ----------------------------------------------------------------------
// Submit Order Request to Pesapal Gateway
// ----------------------------------------------------------------------
export async function executePesapalOrder(
  orderId: string,
  userId: string,
  userEmail: string,
  customConfig?: {
    consumerKey?: string;
    consumerSecret?: string;
    environment?: string;
  }
) {
  const orderRef = admin.firestore().collection("order").doc(orderId.toString());
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    throw new HttpsError("not-found", `Order with ID ${orderId} does not exist.`);
  }

  const order = orderDoc.data();
  if (!order) {
    throw new HttpsError("internal", "Failed to deserialize order data.");
  }

  if (order.userId !== userId) {
    throw new HttpsError("permission-denied", "You do not have permissions to access this order.");
  }

  const { consumerKey, consumerSecret, baseUrl } = resolvePesapalConfig(customConfig);
  const token = await getPesapalToken(baseUrl, consumerKey, consumerSecret);

  const projectId =
    process.env.GCLOUD_PROJECT ||
    admin.instanceId().app.options.projectId ||
    "luxiva-dev";
  const region = process.env.FUNCTION_REGION || "us-central1";
  const ipnId = await getOrRegisterIpnId(baseUrl, token, projectId, region);

  const amount = Number(Number(order.totalPrice).toFixed(2));
  const orderPayload = {
    id: orderId.toString(),
    currency: order.currency || "UGX",
    amount: amount,
    description: `Fancy Deals Order #${order.orderId || orderId}`,
    callback_url: `https://${projectId}.web.app/payment-success`,
    notification_id: ipnId,
    billing_address: {
      email_address: userEmail || "customer@fancydeals.com",
      phone_number: order.mobileMoneyNumber || order.address?.phone || "0700000000",
      country_code: "UG",
      first_name: order.address?.firstName || order.mobileMoneyName || "Fancy",
      last_name: order.address?.lastName || "Customer"
    }
  };

  console.log("Pesapal: Submitting order request payload:", JSON.stringify(orderPayload));

  const response = await axios.post(`${baseUrl}/api/Transactions/SubmitOrderRequest`, orderPayload, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (response.data && response.data.redirect_url) {
    const redirectUrl = response.data.redirect_url;
    const orderTrackingId = response.data.order_tracking_id;

    console.log(`Pesapal: Order successfully submitted. Tracking ID: ${orderTrackingId}`);

    const batch = admin.firestore().batch();
    const updates = {
      paymentProvider: "pesapal",
      paymentId: orderTrackingId,
      paymentStatus: "processing"
    };

    batch.update(orderRef, updates);

    const userOrderRef = admin
      .firestore()
      .collection("user")
      .doc(userId)
      .collection("order")
      .doc(orderId.toString());
    batch.update(userOrderRef, updates);

    await batch.commit();

    return {
      provider: "pesapal",
      status: "redirect",
      redirectUrl: redirectUrl,
      orderTrackingId: orderTrackingId
    };
  } else {
    throw new Error(response.data?.message || "Failed to submit order request to Pesapal.");
  }
}

const WEB_ORDER_ID = /^FD-\d{10,15}-[a-z0-9]{3,10}$/;

/** Website checkout. Shoppers are not signed in, so this does not use the app user id. */
export const shopStartPesapalPayment = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
  const orderId = String(request.data?.orderId || "").trim();
  if (!WEB_ORDER_ID.test(orderId)) {
    throw new HttpsError("invalid-argument", "Invalid orderId");
  }

  const orderRef = admin.firestore().collection("order").doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new HttpsError("not-found", "Order not found");
  }
  const order = orderDoc.data() || {};
  if (order.source !== "shop-web") {
    throw new HttpsError("permission-denied", "Not a website order");
  }
  if (String(order.paymentStatus || "").toLowerCase() === "paid") {
    return { alreadyPaid: true };
  }
  if (order.pesapalRedirectUrl) {
    return { redirectUrl: order.pesapalRedirectUrl };
  }

  const amount = Math.max(
    0,
    Math.round(Number(order.totalPrice) || 0) - Math.round(Number(order.walletApplied) || 0)
  );
  if (amount < 1) {
    throw new HttpsError("failed-precondition", "Nothing to pay");
  }

  const { consumerKey, consumerSecret, baseUrl } = resolvePesapalConfig();
  const token = await getPesapalToken(baseUrl, consumerKey, consumerSecret);
  const projectId =
    process.env.GCLOUD_PROJECT ||
    admin.app().options.projectId ||
    "luxiva-dev";
  const ipnId = await getOrRegisterIpnId(baseUrl, token, projectId, "us-central1");

  const fullName = String(order.customerName || order.mobileMoneyName || "Customer").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "Deals";
  const phone = String(order.mobileMoneyNumber || order.customerPhone || "").replace(/\s/g, "");

  const response = await axios.post(
    `${baseUrl}/api/Transactions/SubmitOrderRequest`,
    {
      id: orderId,
      currency: "UGX",
      amount,
      description: `Fancy Deals ${orderId}`,
      callback_url: "https://fancydealsug.com/",
      notification_id: ipnId,
      billing_address: {
        email_address: "orders@fancydealsug.com",
        phone_number: phone || "0700000000",
        country_code: "UG",
        first_name: firstName,
        last_name: lastName
      }
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    }
  );

  const redirectUrl = response.data?.redirect_url;
  const orderTrackingId = response.data?.order_tracking_id;
  if (!redirectUrl) {
    throw new HttpsError("internal", response.data?.message || "Pesapal did not return a payment page");
  }

  await orderRef.update({
    paymentProvider: "pesapal",
    paymentId: orderTrackingId || "",
    paymentStatus: "processing",
    pesapalRedirectUrl: redirectUrl
  });

  return { redirectUrl, orderTrackingId };
});

// ----------------------------------------------------------------------
// Instant Payment Notification (HTTP Webhook v2)
// ----------------------------------------------------------------------
export const pesapalIpn = onRequest({ cors: true }, async (req, res) => {
  const orderTrackingId = (req.query.OrderTrackingId as string) || req.body?.OrderTrackingId;
  const orderMerchantReference = (req.query.OrderMerchantReference as string) || req.body?.OrderMerchantReference;
  const orderNotificationType = (req.query.OrderNotificationType as string) || req.body?.OrderNotificationType;

  console.log(
    `Pesapal Webhook: Received ping. Tracking ID: ${orderTrackingId}, Ref: ${orderMerchantReference}, Type: ${orderNotificationType}`
  );

  if (!orderTrackingId || !orderMerchantReference) {
    console.warn("Pesapal Webhook: Missing required parameters.");
    res.status(400).send("Missing parameters.");
    return;
  }

  try {
    const configDoc = await admin.firestore().collection("settings").doc("payment_config").get();
    const savedConfig = configDoc.exists ? configDoc.data()?.pesapal : undefined;

    const { consumerKey, consumerSecret, baseUrl } = resolvePesapalConfig(savedConfig);
    const token = await getPesapalToken(baseUrl, consumerKey, consumerSecret);

    console.log(`Pesapal Webhook: Verifying status directly for Tracking ID: ${orderTrackingId}`);
    const response = await axios.get(
      `${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      }
    );

    const statusDetails = response.data;
    console.log("Pesapal Webhook: Verified transaction details:", JSON.stringify(statusDetails));

    const isCompleted =
      statusDetails.status_code === 1 || statusDetails.payment_status_description === "Completed";
    const paymentMethod = statusDetails.payment_method || "Mobile Money (Pesapal)";
    const paymentAccount = statusDetails.payment_account || "";
    const confirmationCode = statusDetails.confirmation_code || "";
    const amount = statusDetails.amount || 0;

    const orderRef = admin.firestore().collection("order").doc(orderMerchantReference);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.error(`Pesapal Webhook: Order ${orderMerchantReference} not found in Firestore.`);
      res.status(404).send("Order not found.");
      return;
    }

    const orderData = orderDoc.data();
    const userId = orderData?.userId;

    const updates: any = {};
    if (isCompleted) {
      updates.paymentStatus = "Paid";
      updates.orderStatus = "Confirmed";
      updates.isPaid = true;
      updates.providerReference = confirmationCode;
      updates.amountPaid = amount;
      updates.paymentMethod = paymentAccount
        ? `${paymentMethod} (${paymentAccount})`
        : paymentMethod;
    } else {
      console.log(`Pesapal Webhook: Transaction status not completed: ${statusDetails.payment_status_description}`);
      updates.paymentStatus = statusDetails.payment_status_description?.toLowerCase() || "failed";
    }

    const batch = admin.firestore().batch();
    batch.update(orderRef, updates);

    if (userId) {
      const userOrderRef = admin
        .firestore()
        .collection("user")
        .doc(userId)
        .collection("order")
        .doc(orderMerchantReference);
      batch.update(userOrderRef, updates);
    }

    await batch.commit();
    console.log(`Pesapal Webhook: Processed transaction for Order ${orderMerchantReference}.`);

    res.status(200).json({
      response: "OK",
      status: 200,
      orderTrackingId: orderTrackingId,
      merchantReference: orderMerchantReference
    });
  } catch (error: any) {
    console.error("Pesapal Webhook: Processing error:", error.response?.data || error.message);
    res.status(500).send("Internal webhook processing failed.");
  }
});
