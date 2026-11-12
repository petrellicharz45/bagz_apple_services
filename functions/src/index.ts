import * as admin from 'firebase-admin';
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { assertAdmin } from "./auth/assertAdmin";

if (!admin.apps.length) {
  admin.initializeApp();
}
export { nylonPayCollect } from "./nylonpay";
export { pesapalIpn, shopStartPesapalPayment } from "./pesapal";
import { executePesapalOrder } from "./pesapal";
import { executeMtnOrder } from "./mtn";
import { executeAirtelOrder } from "./airtel";
export {
  adminGenerateCaption,
  adminAnalyzeProduct,
  aiScanProduct,
  adminCategorizeSubcategoryImage
} from "./ai";

import { buildStockUpdates } from "./stockUtil";

// ----------------------------------------------------------------------
// Firestore Triggers for Automated Push Notifications
// ----------------------------------------------------------------------

// 1. Notify users when a new product is added
export const notifyNewProduct = onDocumentCreated("product/{productId}", async (event) => {
  // Disabled as per client request to reduce over-notifying customers
  return;
});

// 2. Notify a specific user when their order status changes
export const notifyOrderStatusChanged = onDocumentUpdated("order/{orderId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) {
    return;
  }

  // Check if either orderStatus or paymentStatus changed
  const orderStatusChanged = before.orderStatus !== after.orderStatus;
  const paymentStatusChanged = before.paymentStatus !== after.paymentStatus;

  if (!orderStatusChanged && !paymentStatusChanged) {
    return; // Neither status changed, do nothing
  }

  // Construct message based on what changed
  let title = "Order Update";
  let body = "Your order status has changed.";

  if (orderStatusChanged) {
    title = `Order ${after.orderStatus}`;
    body = `Your order is now ${after.orderStatus}.`;
  } else if (paymentStatusChanged && after.paymentStatus === "Paid") {
    title = "Payment Confirmed";
    body = "We have received your payment. Your order is confirmed!";
  }

  // The Android app listens to the global "orders" topic.
  // Sending data-only payload ensures onMessageReceived is always called,
  // even when the app is in the background, so the userId filter works.
  const message = {
    topic: "orders",
    data: {
      type: "order_status",
      orderId: event.params.orderId,
      userId: after.userId,
      title: title,
      body: body
    }
  };

  try {
    await admin.messaging().send(message);
    console.log(`Successfully sent order update notification to user: ${after.userId}`);
  } catch (error) {
    console.error("Error sending order update notification:", error);
  }
});


// ----------------------------------------------------------------------
// Admin Callable Functions
// ----------------------------------------------------------------------

export const adminSetClaim = onCall({ cors: true }, async (request) => {
  // 1. Verify caller is an admin
  assertAdmin(request);

  const { email, uid, admin: grantAdmin } = request.data;

  if (!email && !uid) {
    throw new HttpsError("invalid-argument", "Must provide an email or uid");
  }

  try {
    // 2. Find the user
    let userRecord;
    if (uid) {
      userRecord = await admin.auth().getUser(uid);
    } else {
      userRecord = await admin.auth().getUserByEmail(email);
    }

    // 3. Set custom claim
    const currentClaims = userRecord.customClaims || {};
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      ...currentClaims,
      admin: grantAdmin === true
    });

    // 4. Update the Firestore /admin collection (matches Android App expectations)
    const adminRef = admin.firestore().collection("admin").doc(userRecord.uid);
    if (grantAdmin === true) {
      await adminRef.set({ uid: userRecord.uid, email: userRecord.email });
    } else {
      await adminRef.delete();
    }

    return { 
      success: true, 
      message: `Successfully ${grantAdmin ? 'granted' : 'revoked'} admin for ${userRecord.email}`
    };
  } catch (error: any) {
    console.error("Error setting admin claim:", error);
    throw new HttpsError("internal", "Failed to update user claim: " + error.message);
  }
});

// Update an Order Status in Firestore securely
export const adminUpdateOrderStatus = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const { orderId, status } = request.data;

  if (!orderId || !status) {
    throw new HttpsError("invalid-argument", "Missing orderId or status");
  }

  try {
    const orderRef = admin.firestore().collection("order").doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
       throw new HttpsError("not-found", "Order not found");
    }
    
    const userId = orderDoc.data()?.userId;
    const currentStatus = orderDoc.data()?.orderStatus;
    const stockDeducted = orderDoc.data()?.stockDeducted === true;
    const products = orderDoc.data()?.products || [];

    const stampKey: Record<string, string> = {
      Confirmed: "confirmedAt",
      Shipped: "shippedAt",
      Delivered: "deliveredAt",
      Canceled: "canceledAt"
    };
    const statusPatch: Record<string, unknown> = {
      orderStatus: status,
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (stampKey[status]) {
      statusPatch[stampKey[status]] = admin.firestore.FieldValue.serverTimestamp();
    }

    const batch = admin.firestore().batch();
    batch.update(orderRef, statusPatch);

    if (userId) {
       const userOrderRef = admin.firestore().collection("user").doc(userId).collection("order").doc(orderId);
       batch.update(userOrderRef, statusPatch);
    }

    const activeStatuses = ["Confirmed", "Shipped", "Delivered"];
    const wasActive = activeStatuses.includes(currentStatus || "");
    const isNowActive = activeStatuses.includes(status);

    if (!wasActive && isNowActive && !stockDeducted) {
      for (const item of products) {
        if (item.product?.id && item.quantity) {
          const productRef = admin.firestore().collection("product").doc(item.product.id);
          const productDoc = await productRef.get();
          const updates = buildStockUpdates(productDoc, item, -item.quantity);
          batch.update(productRef, updates);
        }
      }
      batch.update(orderRef, { stockDeducted: true });
    } else if (wasActive && !isNowActive && stockDeducted) {
      for (const item of products) {
        if (item.product?.id && item.quantity) {
          const productRef = admin.firestore().collection("product").doc(item.product.id);
          const productDoc = await productRef.get();
          const updates = buildStockUpdates(productDoc, item, item.quantity);
          batch.update(productRef, updates);
        }
      }
    }

    await batch.commit();

    return { success: true };
  } catch (error: any) {
    throw new HttpsError("internal", "Failed to update order: " + error.message);
  }
});

export const adminConfirmManualPayment = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const { orderId } = request.data;

  if (!orderId) {
    throw new HttpsError("invalid-argument", "Missing orderId");
  }

  try {
    const orderRef = admin.firestore().collection("order").doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
       throw new HttpsError("not-found", "Order not found");
    }
    
    const userId = orderDoc.data()?.userId;

    const updates = {
      paymentStatus: "Paid",
      orderStatus: "Confirmed",
      isPaid: true
    };

    const batch = admin.firestore().batch();
    batch.update(orderRef, updates);

    if (userId) {
       const userOrderRef = admin.firestore().collection("user").doc(userId).collection("order").doc(orderId);
       batch.update(userOrderRef, updates);
    }

    await batch.commit();

    return { success: true };
  } catch (error: any) {
    throw new HttpsError("internal", "Failed to confirm payment: " + error.message);
  }
});

// Send a Promo Notification via Firebase Cloud Messaging
export const adminSendPromoNotification = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  const { title, body, topic } = request.data;

  if (!title || !body || !topic) {
    throw new HttpsError("invalid-argument", "Missing title, body, or topic");
  }

  try {
    const message = {
      notification: {
        title: title,
        body: body
      },
      topic: topic
    };

    await admin.messaging().send(message);
    return { success: true };
  } catch (error: any) {
    throw new HttpsError("internal", "Failed to send notification: " + error.message);
  }
});

export const adminMigrateCategory = onCall({ cors: true }, async (request) => {
  assertAdmin(request);

  const { from, to } = request.data;
  if (!from || !to) {
    throw new HttpsError("invalid-argument", "Missing from or to");
  }

  const productsRef = admin.firestore().collection("product");
  const snapshot = await productsRef.where("category", "==", from).get();

  if (snapshot.empty) {
    return { success: true, migrated: 0, message: `No products with category "${from}"` };
  }

  const batch = admin.firestore().batch();
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { category: to });
  }
  await batch.commit();

  return { success: true, migrated: snapshot.size, from, to };
});

export const adminCleanCategories = onCall({ cors: true }, async (request) => {
  assertAdmin(request);

  const { removeKey, renameFrom, renameTo } = request.data;

  const docRef = admin.firestore().collection("settings").doc("categories");
  const snapshot = await docRef.get();
  const data = snapshot.data() || {};

  if (removeKey) {
    if (removeKey in data) {
      delete data[removeKey];
      await docRef.set(data);
    }
    return { success: true, remaining: Object.keys(data), removed: removeKey };
  }

  if (renameFrom && renameTo) {
    if (!(renameFrom in data)) {
      return { success: true, message: `"${renameFrom}" not found` };
    }
    const imageUrl = data[renameFrom];
    delete data[renameFrom];
    data[renameTo] = imageUrl;
    await docRef.set(data);
    return { success: true, remaining: Object.keys(data) };
  }

  throw new HttpsError("invalid-argument", "Provide removeKey or renameFrom+renameTo");
});

export const adminUpsertProduct = onCall((request) => {
  assertAdmin(request);
  return { success: true };
});

export const adminArchiveProduct = onCall((request) => {
  assertAdmin(request);
  return { success: true };
});

export const adminDeleteProductImage = onCall((request) => {
  assertAdmin(request);
  return { success: true };
});

// ----------------------------------------------------------------------
// Ticket Window: Set 12-hour reporting window when order is delivered
// ----------------------------------------------------------------------

export const onOrderDelivered = onDocumentUpdated("order/{orderId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  if (before.orderStatus === after.orderStatus) return;
  if (after.orderStatus !== "Delivered") return;

  const city = after.address?.city?.toLowerCase() || "";
  const isUpCountry = city !== "kampala";

  const windowHours = isUpCountry ? 12 : 0;
  const ticketWindowEnd = windowHours > 0
    ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + windowHours * 60 * 60 * 1000))
    : null;

  const deliveredAt = admin.firestore.Timestamp.now();

  const batch = admin.firestore().batch();

  const globalOrderRef = admin.firestore().collection("order").doc(event.params.orderId);
  batch.update(globalOrderRef, {
    ticketWindowEnd: ticketWindowEnd,
    deliveredAt: deliveredAt,
    isUpCountry: isUpCountry
  });

  if (after.userId) {
    const userOrderRef = admin.firestore()
      .collection("user").doc(after.userId)
      .collection("order").doc(event.params.orderId);
    batch.update(userOrderRef, {
      ticketWindowEnd: ticketWindowEnd,
      deliveredAt: deliveredAt,
      isUpCountry: isUpCountry
    });
  }

  await batch.commit();
  console.log(`Set ${windowHours}h ticket window for order ${event.params.orderId} (up-country: ${isUpCountry})`);
});

// ----------------------------------------------------------------------
// Ticket Verification: Admin verifies ticket and credits wallet
// ----------------------------------------------------------------------

export const adminVerifyTicket = onCall({ cors: true }, async (request) => {
  assertAdmin(request);

  const { ticketId, action, creditAmount } = request.data;

  if (!ticketId || !action) {
    throw new HttpsError("invalid-argument", "Missing ticketId or action");
  }

  if (action !== "resolve" && action !== "reject") {
    throw new HttpsError("invalid-argument", "Action must be 'resolve' or 'reject'");
  }

  try {
    const ticketRef = admin.firestore().collection("tickets").doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      throw new HttpsError("not-found", "Ticket not found");
    }

    const ticket = ticketDoc.data();
    const userId = ticket?.userId;

    if (action === "resolve") {
      const amount = creditAmount || ticket?.walletCreditAmount || 0;

      await ticketRef.update({
        status: "Resolved",
        walletCreditAmount: amount,
        updatedAt: admin.firestore.Timestamp.now()
      });

      if (userId && amount > 0) {
        const userRef = admin.firestore().collection("user").doc(userId);
        await userRef.update({
          walletBalance: admin.firestore.FieldValue.increment(amount)
        });
      }

      return { success: true, credited: amount };
    } else {
      await ticketRef.update({
        status: "Rejected",
        updatedAt: admin.firestore.Timestamp.now()
      });

      return { success: true, credited: 0 };
    }
  } catch (error: any) {
    throw new HttpsError("internal", "Failed to verify ticket: " + error.message);
  }
});

// ----------------------------------------------------------------------
// Dynamic Payment Dispatcher: Switch seamlessly between Nylon Pay & Pesapal
// ----------------------------------------------------------------------

export const initiatePayment = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can initiate payments.");
  }
  const userId = request.auth.uid;
  const userEmail = request.auth.token.email || "";
  const { orderId, network } = request.data;

  if (!orderId) {
    throw new HttpsError("invalid-argument", "Missing required field: orderId");
  }

  try {
    const configDoc = await admin.firestore().collection("settings").doc("payment_config").get();
    const config = configDoc.exists ? configDoc.data() : null;
    const orderDoc = await admin.firestore().collection("order").doc(orderId.toString()).get();
    const order = orderDoc.data();
    const phone = order?.mobileMoneyNumber || order?.customerPhone || order?.address?.phone || "";

    // Nylon Pay + Pesapal are hidden. Route by customer-selected network (mtn | airtel).
    const selected = String(network || config?.activeProvider || "mtn").toLowerCase();

    if (selected === "airtel") {
      console.log(`Payment Dispatcher: Routing order ${orderId} through Airtel Money (direct)`);
      return await executeAirtelOrder(orderId, userId, userEmail, phone, config?.airtel);
    }

    if (selected === "mtn" || selected === "mtn_momo") {
      console.log(`Payment Dispatcher: Routing order ${orderId} through MTN MoMo (direct)`);
      return await executeMtnOrder(orderId, userId, userEmail, phone, config?.mtn);
    }

    // Legacy providers intentionally disabled (kept in codebase for rollback only).
    if (selected === "pesapal" || selected === "nylonpay") {
      return {
        status: "not_configured",
        provider: selected,
        message: "Legacy gateways are disabled. Use MTN or Airtel Mobile Money."
      };
    }

    console.log(`Payment Dispatcher: Defaulting order ${orderId} to MTN MoMo (direct)`);
    return await executeMtnOrder(orderId, userId, userEmail, phone, config?.mtn);
  } catch (error: any) {
    console.error("Payment Dispatcher Error:", error.message || error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to initiate payment.");
  }
});

export const pesapalInitiatePayment = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const configDoc = await admin.firestore().collection("settings").doc("payment_config").get();
  const config = configDoc.exists ? configDoc.data()?.pesapal : undefined;
  return await executePesapalOrder(
    request.data.orderId,
    request.auth.uid,
    request.auth.token.email || "",
    config
  );
});

// Admin endpoint: Retrieve current payment configuration (secured by assertAdmin)
export const adminGetPaymentConfig = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);
  const doc = await admin.firestore().collection("settings").doc("payment_config").get();
  const data = doc.exists ? doc.data() : {};
  return {
    activeProvider: data?.activeProvider === "airtel" ? "airtel" : "mtn",
    mtn: {
      apiUser: data?.mtn?.apiUser || process.env.MTN_API_USER || "",
      apiKey: data?.mtn?.apiKey || process.env.MTN_API_KEY || "",
      subscriptionKey: data?.mtn?.subscriptionKey || process.env.MTN_SUBSCRIPTION_KEY || "",
      environment: data?.mtn?.environment || process.env.MTN_ENVIRONMENT || "sandbox"
    },
    airtel: {
      clientId: data?.airtel?.clientId || process.env.AIRTEL_CLIENT_ID || "",
      clientSecret: data?.airtel?.clientSecret || process.env.AIRTEL_CLIENT_SECRET || "",
      environment: data?.airtel?.environment || process.env.AIRTEL_ENVIRONMENT || "sandbox"
    }
  };
});

// Admin endpoint: Save payment configuration & active provider (secured by assertAdmin)
export const adminSavePaymentConfig = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);
  const { activeProvider, mtn, airtel } = request.data;

  if (activeProvider !== "mtn" && activeProvider !== "airtel") {
    throw new HttpsError("invalid-argument", "activeProvider must be 'mtn' or 'airtel'");
  }

  const batch = admin.firestore().batch();
  const secretConfigRef = admin.firestore().collection("settings").doc("payment_config");
  const publicConfigRef = admin.firestore().collection("settings").doc("payment");

  batch.set(
    secretConfigRef,
    {
      activeProvider,
      mtn: {
        apiUser: (mtn?.apiUser || "").trim(),
        apiKey: (mtn?.apiKey || "").trim(),
        subscriptionKey: (mtn?.subscriptionKey || "").trim(),
        environment: mtn?.environment === "production" ? "production" : "sandbox"
      },
      airtel: {
        clientId: (airtel?.clientId || "").trim(),
        clientSecret: (airtel?.clientSecret || "").trim(),
        environment: airtel?.environment === "production" ? "production" : "sandbox"
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  // Public config allows the Android client to know which provider is active
  batch.set(
    publicConfigRef,
    {
      activeProvider,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await batch.commit();

  return { success: true, activeProvider };
});

export {
  adminInviteStaff,
  adminListStaffInvites,
  adminResendStaffInvite,
  adminRevokeStaffInvite,
  getStaffInviteByToken,
  acceptStaffInvite,
  adminUpdateStaffAccess
} from "./staffInvites";

export {
  auditOrderCreated,
  auditOrderUpdated,
  auditUserCreated,
  auditProductCreated,
  auditProductUpdated,
  auditTicketCreated
} from "./auditTriggers";

export { shopDeductCatalogStock, syncStockOnOrderPaid } from "./orderStock";
export { shopCreateWebOrder } from "./webOrders";


