import { writable } from "svelte/store";
import { onAuthStateChanged } from "firebase/auth";
import { browser } from "$app/environment";
import { auth, firebaseInitError } from "$lib/firebase";
import { isAdminClaim, isBootstrapAdminEmail, isDevAdminEmail } from "$lib/auth/claims";

export const userStore = writable<null | { uid: string; email: string | null; photoURL: string | null }>(
  null
);
export const adminStore = writable(false);
export const loadingStore = writable(true);
export const firebaseErrorStore = writable<string | null>(null);

export const deriveAdminFlag = (claims: Record<string, unknown> | null, email?: string | null) => {
  if (claims && isAdminClaim(claims)) return true;
  if (isBootstrapAdminEmail(email)) return true;
  return isDevAdminEmail(email);
};

if (browser && auth) {
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        userStore.set(null);
        adminStore.set(false);
        loadingStore.set(false);
        return;
      }

      const token = await user.getIdTokenResult();
      userStore.set({ uid: user.uid, email: user.email });
      adminStore.set(deriveAdminFlag(token.claims, user.email));
      loadingStore.set(false);
    } catch (error) {
      firebaseErrorStore.set(error instanceof Error ? error.message : "Firebase auth failed");
      userStore.set(null);
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
