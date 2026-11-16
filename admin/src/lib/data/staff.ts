/**
 * Staff accounts (Users & Roles page). Works on the free Firebase plan: no Cloud Functions.
 *
 * - New logins are created with a second, throw-away Firebase app so the admin who is adding
 *   the person stays signed in.
 * - Role and permissions live in staff/{uid}; Firestore rules only let full admins write there.
 * - Firebase has no client-side way to set someone else's password or delete their login, so
 *   "Reset password" emails them a link, and "Remove" takes away all admin access.
 */
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { auth, db, firebaseConfig } from "$lib/firebase";
import { cleanPerms, type Perms } from "$lib/auth/permissions";

export type StaffMember = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  perms: Perms;
  active: boolean;
  createdAt: number | null;
  createdBy: string;
};

const millis = (v: any): number | null =>
  typeof v === "number" ? v : typeof v?.toMillis === "function" ? v.toMillis() : null;

export async function listStaff(): Promise<StaffMember[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, "staff"));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        name: String(x.name || ""),
        email: String(x.email || ""),
        phone: String(x.phone || ""),
        role: String(x.role || "custom"),
        perms: cleanPerms(x.perms),
        active: x.active !== false,
        createdAt: millis(x.createdAt),
        createdBy: String(x.createdBy || "")
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function friendlyError(e: any): string {
  const code = String(e?.code || "");
  if (code === "auth/invalid-email") return "That email address is not valid.";
  if (code === "auth/weak-password") return "The password is too weak. Use at least 8 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes and try again.";
  if (code === "auth/network-request-failed") return "Network problem. Check the internet connection.";
  if (code === "auth/operation-not-allowed") return "Email/password sign-in is switched off in Firebase.";
  if (code === "permission-denied") return "Only admins can add or change users.";
  return e?.message || "Something went wrong.";
}

export type NewStaff = { name: string; email: string; phone: string; password: string; role: string; perms: Perms };

/**
 * Create the login (email + password) and the staff record.
 * If the email already has a login (for example a shop customer account), that account is given
 * admin access instead, and `existingAccount` is true: they keep their own password.
 */
export async function createStaff(input: NewStaff): Promise<{ uid: string; existingAccount: boolean }> {
  if (!db) throw new Error("Firebase is not ready.");
  const email = input.email.trim().toLowerCase();
  let uid = "";
  let existingAccount = false;

  const temp = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  const tempAuth = getAuth(temp);
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, input.password);
    uid = cred.user.uid;
    if (input.name.trim()) await updateProfile(cred.user, { displayName: input.name.trim() }).catch(() => {});
  } catch (e: any) {
    if (e?.code !== "auth/email-already-in-use") throw new Error(friendlyError(e));
    // The person already has a login: find it through their shop profile.
    const found = await getDocs(query(collection(db, "user"), where("email", "==", email), limit(1)));
    if (found.empty) {
      throw new Error(
        "This email already has a login, but no shop profile was found for it. Use another email, " +
          "or ask the person to sign in to the shop once with it and then try again."
      );
    }
    uid = found.docs[0].id;
    existingAccount = true;
  } finally {
    await signOut(tempAuth).catch(() => {});
    await deleteApp(temp).catch(() => {});
  }

  try {
    await setDoc(doc(db, "staff", uid), {
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      role: input.role,
      perms: cleanPerms(input.perms),
      active: true,
      createdAt: serverTimestamp(),
      createdBy: auth?.currentUser?.email || "",
      updatedAt: serverTimestamp()
    });
  } catch (e: any) {
    throw new Error(
      `The login for ${email} was created, but saving the role failed: ${friendlyError(e)} ` +
        "Try adding the same email again to finish."
    );
  }
  return { uid, existingAccount };
}

export async function updateStaff(
  uid: string,
  patch: Partial<Pick<StaffMember, "name" | "phone" | "role" | "perms" | "active">>
) {
  if (!db) throw new Error("Firebase is not ready.");
  const data: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  if (patch.perms) data.perms = cleanPerms(patch.perms);
  try {
    await updateDoc(doc(db, "staff", uid), data);
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function removeStaff(uid: string) {
  if (!db) throw new Error("Firebase is not ready.");
  try {
    await deleteDoc(doc(db, "staff", uid));
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

/** Firebase emails the person a link to choose a new password. */
export async function sendStaffPasswordReset(email: string) {
  if (!auth) throw new Error("Firebase is not ready.");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
