import * as admin from "firebase-admin";

export async function writeSystemAudit(entry: {
  action: string;
  entityType: string;
  entityId?: string;
  message: string;
  actorUid?: string;
  actorEmail?: string;
  meta?: Record<string, unknown>;
}) {
  await admin.firestore().collection("adminAuditLog").add({
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId || "",
    message: entry.message,
    actorUid: entry.actorUid || "system",
    actorEmail: entry.actorEmail || "",
    meta: entry.meta || {},
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
