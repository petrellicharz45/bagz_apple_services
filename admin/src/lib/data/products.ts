import { collection, getDocs, getDocsFromServer, query, limit, startAfter, QueryDocumentSnapshot, doc, deleteDoc, getDoc, onSnapshot, orderBy, documentId } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "$lib/firebase";

export const mapProductForm = (input: any) => {
  return {
    ...input,
    nameLowercase: input.name ? input.name.toLowerCase() : "",
  };
};

export function productCreatedAtMs(product: any): number {
  const raw = product?.createdAt ?? product?.updatedAt ?? 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && typeof raw.seconds === "number") {
    return raw.seconds * 1000;
  }
  return 0;
}

/** Newest first; tie-break by name. */
export function sortProductsNewestFirst(items: any[]) {
  items.sort((a, b) => {
    const diff = productCreatedAtMs(b) - productCreatedAtMs(a);
    if (diff !== 0) return diff;
    return (a.name || "").localeCompare(b.name || "");
  });
  return items;
}

export const fetchAllProducts = async () => {
  const snapshot = await getDocsFromServer(collection(db, "product"));
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  return sortProductsNewestFirst(items);
};

const PAGE = 400;

export const fetchAllProductsPaged = async (
  onPage?: (soFar: any[]) => void
) => {
  const items: any[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    const q = lastDoc
      ? query(collection(db, "product"), orderBy(documentId()), startAfter(lastDoc), limit(PAGE))
      : query(collection(db, "product"), orderBy(documentId()), limit(PAGE));
    const snapshot = await getDocsFromServer(q);
    if (snapshot.empty) break;
    snapshot.docs.forEach((d) => {
      items.push({ id: d.id, ...d.data() });
    });
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    onPage?.(items);
    if (snapshot.size < PAGE) break;
  }

  sortProductsNewestFirst(items);
  onPage?.(items);
  return items;
};

export function productMatchesSearch(product: any, raw: string): boolean {
  const term = raw.trim().toLowerCase().replace(/[/_,.-]+/g, " ");
  if (!term) return true;
  const hay = [
    product.name,
    product.nameLowercase,
    product.category,
    product.id,
    product.description,
    product.slug,
    product.seoKeywords
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return term.split(/\s+/).every((token) => hay.includes(token));
}

export const fetchProducts = async (pageSize: number = 20, lastDoc?: QueryDocumentSnapshot) => {
  let q = query(collection(db, "product"), limit(pageSize));
  if (lastDoc) {
    q = query(collection(db, "product"), startAfter(lastDoc), limit(pageSize));
  }
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  sortProductsNewestFirst(items);
  return {
    docs: snapshot.docs,
    items
  };
};

export const listenProducts = (
  callback: (items: any[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, "product"));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      sortProductsNewestFirst(items);
      callback(items);
    },
    (error) => {
      console.error("listenProducts error:", error);
      onError?.(error);
    }
  );
};

export const fetchProduct = async (productId: string) => {
  const docRef = doc(db, "product", productId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("Product not found");
  return { id: snapshot.id, ...snapshot.data() };
};

export const deleteProduct = async (productId: string) => {
  const docRef = doc(db, "product", productId);
  
  // 1. Fetch product to get image URLs
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const data = snapshot.data();
    const images: string[] = data.images || [];
    
    // 2. Delete images from Firebase Storage
    for (const imageUrl of images) {
      try {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
      } catch (err) {
        console.error("Failed to delete image from storage:", imageUrl, err);
      }
    }
  }

  // 3. Delete Firestore Document
  await deleteDoc(docRef);
};
