import { collection, doc, getDoc, getDocs, query, orderBy, limit, startAfter, QueryDocumentSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "$lib/firebase";

export const fetchOrders = async (pageSize: number = 20, lastDoc?: QueryDocumentSnapshot) => {
  let q = query(collection(db, "order"), orderBy("timestamp", "desc"), limit(pageSize));
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snapshot = await getDocs(q);
  return {
    docs: snapshot.docs,
    items: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
};

/** Pull up to `max` recent orders for analytics (paged). */
export const fetchOrdersForAnalytics = async (max = 500) => {
  const items: Record<string, unknown>[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;
  const pageSize = 100;
  while (items.length < max) {
    const batch = await fetchOrders(pageSize, lastDoc);
    if (!batch.items.length) break;
    items.push(...batch.items);
    lastDoc = batch.docs[batch.docs.length - 1];
    if (batch.items.length < pageSize) break;
  }
  return items.slice(0, max);
};

export const fetchOrder = async (orderId: string) => {
  const docRef = doc(db, "order", orderId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Order not found");
  return { id: snapshot.id, ...snapshot.data() };
};

export const deleteOrder = async (orderId: string, userId?: string) => {
  if (userId) {
    const userOrderRef = doc(db, "user", userId, "order", orderId);
    try { await deleteDoc(userOrderRef); } catch (e) { console.error(e); }
  }
  const globalOrderRef = doc(db, "order", orderId);
  await deleteDoc(globalOrderRef);
};
