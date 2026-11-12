import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { writeSystemAudit } from "./adminAudit";

export const auditOrderCreated = onDocumentCreated("order/{orderId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await writeSystemAudit({
    action: "order.created",
    entityType: "order",
    entityId: event.params.orderId,
    message: `Order placed — UGX ${Math.round(Number(data.totalPrice || 0))} (${data.paymentStatus || "pending"})`,
    actorUid: String(data.userId || ""),
    meta: { orderStatus: data.orderStatus, paymentStatus: data.paymentStatus }
  });
});

export const auditOrderUpdated = onDocumentUpdated("order/{orderId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const changes: string[] = [];
  if (before.orderStatus !== after.orderStatus) {
    changes.push(`orderStatus: ${before.orderStatus} → ${after.orderStatus}`);
  }
  if (before.paymentStatus !== after.paymentStatus) {
    changes.push(`paymentStatus: ${before.paymentStatus} → ${after.paymentStatus}`);
  }
  if (!changes.length) return;
  await writeSystemAudit({
    action: "order.updated",
    entityType: "order",
    entityId: event.params.orderId,
    message: changes.join("; "),
    actorUid: String(after.userId || ""),
    meta: { before: { orderStatus: before.orderStatus, paymentStatus: before.paymentStatus }, after }
  });
});

export const auditUserCreated = onDocumentCreated("user/{userId}", async (event) => {
  const data = event.data?.data();
  await writeSystemAudit({
    action: "user.registered",
    entityType: "user",
    entityId: event.params.userId,
    message: `New user: ${data?.email || event.params.userId}`,
    meta: { email: data?.email }
  });
});

export const auditProductCreated = onDocumentCreated("product/{productId}", async (event) => {
  const data = event.data?.data();
  await writeSystemAudit({
    action: "product.created",
    entityType: "product",
    entityId: event.params.productId,
    message: `Product added: ${data?.name || event.params.productId}`,
    meta: { stock: data?.stock }
  });
});

export const auditProductUpdated = onDocumentUpdated("product/{productId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      if (k === "stock") changed.push(`stock: ${before.stock} → ${after.stock}`);
      else if (["name", "price", "category", "subcategory"].includes(k)) {
        changed.push(`${k} updated`);
      }
    }
  }
  if (!changed.length) return;
  await writeSystemAudit({
    action: "product.updated",
    entityType: "product",
    entityId: event.params.productId,
    message: changed.slice(0, 5).join("; ") || "Product fields updated",
    meta: { fields: changed }
  });
});

export const auditTicketCreated = onDocumentCreated("tickets/{ticketId}", async (event) => {
  const data = event.data?.data();
  await writeSystemAudit({
    action: "ticket.created",
    entityType: "ticket",
    entityId: event.params.ticketId,
    message: `Support ticket: ${data?.subject || data?.topic || event.params.ticketId}`,
    actorUid: String(data?.userId || "")
  });
});
