import * as admin from 'firebase-admin';
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as crypto from 'crypto';

// ----------------------------------------------------------------------
// Nylon Pay SDK Initialization
// ----------------------------------------------------------------------
async function getNylonPayClient(customApiKey?: string, customApiSecret?: string) {
  const m = await new Function('return import("@nile-squad/nylonpay-ts")')();
  const { createNylonPay } = m;
  
  const apiKey = customApiKey || process.env.NYLON_PAY_API_KEY;
  const apiSecret = customApiSecret || process.env.NYLON_PAY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Nylon Pay API credentials not configured');
  }

  return createNylonPay({
    apiKey,
    apiSecret,
    maxPollDurationMs: 180000, // 3 minutes max wait for customer approval
    maxPollAttempts: 90,
    timeoutMs: 30000,
  });
}

// ----------------------------------------------------------------------
// Core Execution Logic for Nylon Pay
// ----------------------------------------------------------------------
export async function executeNylonPayOrder(
  orderId: string,
  userId: string,
  userEmail: string,
  customConfig?: {
    apiKey?: string;
    apiSecret?: string;
  }
) {
  // 1. Fetch Order from Firestore
  console.log(`NylonPay: Fetching order details for ID: ${orderId}`);
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

  // 2. Initialize Nylon Pay SDK with dynamic or env credentials
  const nylonpay = await getNylonPayClient(customConfig?.apiKey, customConfig?.apiSecret);

  let customerPhone = order.mobileMoneyNumber || order.address?.phone || "";
  if (customerPhone.startsWith("0")) {
    customerPhone = "256" + customerPhone.substring(1);
  } else if (customerPhone.startsWith("+256")) {
    customerPhone = customerPhone.substring(1);
  }
  const customerName =
    `${order.address?.firstName || ''} ${order.address?.lastName || ''}`.trim() ||
    order.mobileMoneyName ||
    "Bagz Customer";
  const customerEmail = userEmail || "";
  const amount = Math.round(Number(order.totalPrice));
  const reference = crypto.randomUUID();

  console.log(
    `NylonPay: Initiating payment. Amount: ${amount} ${order.currency || 'UGX'}, Phone: ${customerPhone}, Reference: ${reference}`
  );

  // 3. Initiate Payment Collection — customer gets USSD prompt on phone
  const payment = await nylonpay.collectPayment({
    amount: amount,
    currency: (order.currency || 'UGX') as any,
    description: `Bagz Apple Services Order #${order.orderId || orderId}`,
    customer: {
      name: customerName,
      phoneNumber: customerPhone,
      email: customerEmail || undefined,
    },
    reference: reference,
    metadata: {
      orderId: orderId.toString(),
      userId: userId,
    },
  });

  // 4. Update order with payment reference immediately (status: processing)
  const processingUpdates = {
    paymentProvider: "nylonpay",
    paymentId: reference,
    paymentStatus: "processing",
  };

  const batch = admin.firestore().batch();
  batch.update(orderRef, processingUpdates);
  const userOrderRef = admin.firestore().collection("user").doc(userId).collection("order").doc(orderId.toString());
  batch.update(userOrderRef, processingUpdates);
  await batch.commit();

  console.log(`NylonPay: Payment initiated. Reference: ${reference}. Waiting for customer to approve...`);

  // 5. Wait for terminal state (customer approves/rejects on phone)
  const transaction = await payment.wait();

  if (transaction) {
    console.log(`NylonPay: Payment SUCCESS. Transaction ID: ${transaction.id}, Reference: ${reference}`);

    const successUpdates: any = {
      paymentStatus: "Paid",
      orderStatus: "Confirmed",
      isPaid: true,
      providerReference: transaction.id || reference,
      amountPaid: amount,
      paymentMethod: "Mobile Money (Nylon Pay)",
    };

    const successBatch = admin.firestore().batch();
    successBatch.update(orderRef, successUpdates);
    successBatch.update(userOrderRef, successUpdates);
    await successBatch.commit();

    console.log(`NylonPay: Firestore updated. Order ${orderId} confirmed.`);

    return {
      provider: "nylonpay",
      status: "success",
      message: "Payment completed successfully",
      transactionId: transaction.id,
      reference: reference,
    };
  } else {
    console.log(`NylonPay: Payment FAILED or CANCELLED. Reference: ${reference}`);

    const failedUpdates = {
      paymentStatus: "failed",
    };

    const failBatch = admin.firestore().batch();
    failBatch.update(orderRef, failedUpdates);
    failBatch.update(userOrderRef, failedUpdates);
    await failBatch.commit();

    return {
      provider: "nylonpay",
      status: "failed",
      message: "Payment was not completed. Please try again.",
      reference: reference,
    };
  }
}

// ----------------------------------------------------------------------
// Endpoint: Standalone Nylon Pay Collection Callable V2
// ----------------------------------------------------------------------
export const nylonPayCollect = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can initiate payments.");
  }
  const userId = request.auth.uid;
  const { orderId } = request.data;

  if (!orderId) {
    throw new HttpsError("invalid-argument", "Missing required field: orderId");
  }

  try {
    const configDoc = await admin.firestore().collection("settings").doc("payment_config").get();
    const customConfig = configDoc.exists ? configDoc.data()?.nylonPay : undefined;

    return await executeNylonPayOrder(orderId, userId, request.auth.token.email || "", customConfig);
  } catch (error: any) {
    console.error("NylonPay: Payment error:", error.message || error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to process payment.");
  }
});
