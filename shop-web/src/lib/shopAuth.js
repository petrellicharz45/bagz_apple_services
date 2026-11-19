import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore/lite";
import { writable } from "svelte/store";
import { app, db } from "./firebase.js";
import { readProfile, saveProfile } from "./accountStore.js";

export const auth = getAuth(app);
export const authUser = writable(null);

if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (user) => {
    authUser.set(user);
  });
}

export async function registerShopper({ firstName, lastName, email, phone, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  await setDoc(doc(db, "user", cred.user.uid), {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    phone: (phone || "").trim(),
    walletBalance: 0
  });
  saveProfile({ ...readProfile(), name, email: email.trim(), phone: (phone || "").trim() });
  return cred.user;
}

export async function loginShopper(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  saveProfile({ ...readProfile(), email: cred.user.email || email.trim() });
  return cred.user;
}

export async function logoutShopper() {
  await signOut(auth);
  saveProfile({ ...readProfile(), name: "", email: "", phone: "" });
}

export function authErrorText(error) {
  const code = error?.code || "";
  if (code === "auth/email-already-in-use") return "That email is already registered. Log in instead.";
  if (code === "auth/invalid-email") return "Enter a real email address.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "Email or password is wrong.";
  if (code === "auth/weak-password") return "Use a password of at least 6 characters.";
  if (code === "auth/user-not-found") return "No account with that email. Create one first.";
  return error?.message || "Could not continue.";
}
