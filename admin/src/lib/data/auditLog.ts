import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  startAfter,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { db } from "$lib/firebase";
import { userStore } from "$lib/stores/auth";
import { get } from "svelte/store";

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  message: string;
  actorUid?: string;
  actorEmail?: string;
  meta?: Record<string, unknown>;
  createdAt: Date | null;
};

export async function logAdminAudit(
  action: string,
  entityType: string,
  message: string,
  entityId?: string,
  meta?: Record<string, unknown>
) {
  if (!db) return;
  const user = get(userStore);
  await addDoc(collection(db, "adminAuditLog"), {
    action,
    entityType,
    entityId: entityId || "",
    message,
    actorUid: user?.uid || "",
    actorEmail: user?.email || "",
    meta: meta || {},
    createdAt: Timestamp.now()
  });
}

export async function fetchAuditLogs(opts: {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
  entityType?: string;
  action?: string;
  from?: Date;
  to?: Date;
}) {
  const pageSize = opts.pageSize ?? 80;
  let q = query(collection(db, "adminAuditLog"), orderBy("createdAt", "desc"), limit(pageSize));
  if (opts.lastDoc) {
    q = query(q, startAfter(opts.lastDoc));
  }
  const snapshot = await getDocs(q);
  let items: AuditEntry[] = snapshot.docs.map((doc) => {
    const d = doc.data();
    const ts = d.createdAt;
    let createdAt: Date | null = null;
    if (ts?.seconds) createdAt = new Date(ts.seconds * 1000);
    return {
      id: doc.id,
      action: String(d.action || ""),
      entityType: String(d.entityType || ""),
      entityId: d.entityId ? String(d.entityId) : "",
      message: String(d.message || ""),
      actorUid: d.actorUid ? String(d.actorUid) : "",
      actorEmail: d.actorEmail ? String(d.actorEmail) : "",
      meta: (d.meta as Record<string, unknown>) || {},
      createdAt
    };
  });
  if (opts.entityType) {
    items = items.filter((i) => i.entityType === opts.entityType);
  }
  if (opts.action) {
    items = items.filter((i) => i.action.toLowerCase().includes(opts.action!.toLowerCase()));
  }
  if (opts.from) {
    items = items.filter((i) => i.createdAt && i.createdAt >= opts.from!);
  }
  if (opts.to) {
    items = items.filter((i) => i.createdAt && i.createdAt <= opts.to!);
  }
  return {
    items,
    lastDoc: snapshot.docs[snapshot.docs.length - 1]
  };
}
