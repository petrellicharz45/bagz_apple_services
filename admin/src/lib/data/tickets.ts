import { collection, doc, getDoc, getDocs, query, orderBy, limit, startAfter, QueryDocumentSnapshot, updateDoc, where } from "firebase/firestore";
import { db } from "$lib/firebase";

export const fetchTickets = async (pageSize: number = 20, lastDoc?: QueryDocumentSnapshot, statusFilter?: string) => {
  let q;
  if (statusFilter && statusFilter !== "All") {
    q = query(collection(db, "tickets"), where("status", "==", statusFilter), orderBy("createdAt", "desc"), limit(pageSize));
  } else {
    q = query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(pageSize));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snapshot = await getDocs(q);
  return {
    docs: snapshot.docs,
    items: snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  };
};

export const fetchTicket = async (ticketId: string) => {
  const docRef = doc(db, "tickets", ticketId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Ticket not found");
  return { id: snapshot.id, ...snapshot.data() };
};
