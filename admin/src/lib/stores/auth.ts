import { writable } from "svelte/store";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { browser } from "$app/environment";
import { auth, db, firebaseInitError } from "$lib/firebase";
import { isAdminClaim, isBootstrapAdminEmail, isDevAdminEmail } from "$lib/auth/claims";
import { cleanPerms, ownerAccess, type Access } from "$lib/auth/permissions";

export const userStore = writable<null | { uid: string; email: string | null; photoURL: string | null }>(
  null
);
/** True when the signed-in person may use the admin (owner or active staff). */
export const adminStore = writable(false);
/** Role and permissions of the signed-in person (null = no admin access). */
export const accessStore = writable<Access | null>(null);
export const loadingStore = writable(true);
export const firebaseErrorStore = writable<string | null>(null);

export const deriveAdminFlag = (claims: Record<string, unknown> | null, email?: string | null) => {
  if (claims && isAdminClaim(claims)) return true;
  if (isBootstrapAdminEmail(email)) return true;
  return isDevAdminEmail(email);
};

export type AccessResult = { access: Access | null; reason?: "not-staff" | "disabled" };

/** Owner (admin claim) or a staff member with an active staff/{uid} document. */
export async function resolveAccess(user: User, forceRefresh = false): Promise<AccessResult> {
  const token = await user.getIdTokenResult(forceRefresh);
  const name = user.displayName || user.email || "Admin";
  if (deriveAdminFlag(token.claims, user.email)) return { access: ownerAccess(name) };
  if (!db) return { access: null, reason: "not-staff" };
  const snap = await getDoc(doc(db, "staff", user.uid)).catch(() => null);
  if (!snap?.exists()) return { access: null, reason: "not-staff" };
  const data = snap.data();
  if (data.active === false) return { access: null, reason: "disabled" };
  return {
    access: {
      kind: "staff",
      role: String(data.role || "custom"),
      name: String(data.name || name),
      perms: cleanPerms(data.perms)
    }
  };
}

if (browser && auth) {
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        userStore.set(null);
        accessStore.set(null);
        adminStore.set(false);
        loadingStore.set(false);
        return;
      }

      const { access } = await resolveAccess(user);
      userStore.set({ uid: user.uid, email: user.email, photoURL: user.photoURL });
      accessStore.set(access);
      adminStore.set(Boolean(access));
      loadingStore.set(false);
    } catch (error) {
      firebaseErrorStore.set(error instanceof Error ? error.message : "Firebase auth failed");
      userStore.set(null);
      accessStore.set(null);
      adminStore.set(false);
      loadingStore.set(false);
    }
  });
} else if (browser && !auth) {
  firebaseErrorStore.set(firebaseInitError || "Firebase did not initialize. Check admin/.env values.");
  loadingStore.set(false);
} else {
  loadingStore.set(false);
}
