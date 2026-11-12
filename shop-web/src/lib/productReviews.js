import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase.js";
import { readProfile } from "./accountStore.js";

const MY_REVIEWS_KEY = "bagz_my_reviews_v1";
const REVIEWER_ID_KEY = "bagz_reviewer_id_v1";

/** Stable id for this browser (no Firebase login required). */
export function getShopReviewerId() {
  try {
    let id = localStorage.getItem(REVIEWER_ID_KEY);
    if (!id || !/^fd_[a-f0-9]{32}$/i.test(id)) {
      id = `fd_${crypto.randomUUID().replace(/-/g, "")}`;
      localStorage.setItem(REVIEWER_ID_KEY, id);
    }
    return id;
  } catch {
    return `fd_${crypto.randomUUID().replace(/-/g, "")}`;
  }
}

function displayName() {
  const p = readProfile();
  const name = (p.name || "").trim();
  if (name) return name;
  const email = (p.email || "").trim();
  if (email) return email.split("@")[0];
  return "Bagz shopper";
}

function ratingRef(productId, reviewerId) {
  return doc(db, "product", productId, "userRatings", reviewerId);
}

export async function loadProductReviews(productId, max = 40) {
  if (!productId) return [];
  try {
    const q = query(
      collection(db, "product", productId, "userRatings"),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return mapReviewDocs(snap.docs);
  } catch {
    try {
      const snap = await getDocs(collection(db, "product", productId, "userRatings"));
      return mapReviewDocs(snap.docs)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, max);
    } catch {
      return [];
    }
  }
}

function mapReviewDocs(docs) {
  return docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      rating: Number(data.rating) || 0,
      text: (data.text || "").trim(),
      displayName: (data.displayName || "Shopper").trim(),
      createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? 0
    };
  });
}

export async function getMyRatingForProduct(productId) {
  const reviewerId = getShopReviewerId();
  const snap = await getDoc(ratingRef(productId, reviewerId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    rating: Number(data.rating) || 0,
    text: (data.text || "").trim()
  };
}

function rememberMyReview(productId, productName, rating, text) {
  try {
    const map = JSON.parse(localStorage.getItem(MY_REVIEWS_KEY) || "{}");
    map[productId] = {
      productId,
      productName: productName || "",
      rating,
      text,
      updatedAt: Date.now()
    };
    localStorage.setItem(MY_REVIEWS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readMyReviewsIndex() {
  try {
    const map = JSON.parse(localStorage.getItem(MY_REVIEWS_KEY) || "{}");
    return Object.values(map).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

function friendlyReviewError(err) {
  const code = err?.code || "";
  if (code === "permission-denied") {
    return "Reviews are blocked by Firestore rules. Deploy the latest firestore.rules from the Luxiva/firebase folder.";
  }
  if (code === "auth/admin-restricted-operation" || code === "auth/operation-not-allowed") {
    return "Could not sign in for reviews. Refresh the page and try again — the shop uses a guest id, not admin login.";
  }
  return err?.message || "Could not post review. Try again.";
}

/**
 * Submit star rating + comment to product/{id}/userRatings/{reviewerId}.
 * Works on the web without Firebase login (same collection the app uses with user uid).
 */
export async function submitProductReview(product, { rating, text }) {
  const productId = product?.id;
  if (!productId) throw new Error("Product not found.");
  const stars = Math.round(Number(rating));
  if (stars < 1 || stars > 5) throw new Error("Choose a star rating from 1 to 5.");
  const comment = (text || "").trim();
  if (comment.length > 2000) throw new Error("Review is too long (max 2000 characters).");

  const reviewerId = getShopReviewerId();
  const ref = ratingRef(productId, reviewerId);

  try {
    const existing = await getDoc(ref);

    const payload = {
      reviewerId,
      rating: stars,
      text: comment,
      displayName: displayName(),
      source: "shop-web",
      updatedAt: serverTimestamp(),
      createdAt: existing.exists()
        ? existing.data().createdAt || serverTimestamp()
        : serverTimestamp()
    };

    await setDoc(ref, payload, { merge: true });

    const oldCount = Number(product.reviewsCount) || 0;
    const oldRating = Number(product.rating) || 0;

    if (!existing.exists()) {
      const newCount = oldCount + 1;
      const newRating = (oldRating * oldCount + stars) / newCount;
      await updateDoc(doc(db, "product", productId), {
        rating: newRating,
        reviewsCount: newCount
      });
      product.rating = newRating;
      product.reviewsCount = newCount;
    } else {
      const prevStars = Number(existing.data().rating) || 0;
      if (prevStars !== stars && oldCount > 0) {
        const newRating = (oldRating * oldCount - prevStars + stars) / oldCount;
        await updateDoc(doc(db, "product", productId), { rating: newRating });
        product.rating = newRating;
      }
    }

    rememberMyReview(productId, product.name, stars, comment);
    return { rating: stars, text: comment };
  } catch (err) {
    throw new Error(friendlyReviewError(err));
  }
}
