import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { browser } from "$app/environment";
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_APP_ID
} from "$env/static/public";

export const firebaseConfig = {
  apiKey: PUBLIC_FIREBASE_API_KEY,
  authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: PUBLIC_FIREBASE_APP_ID
};

export let firebaseInitError: string | null = null;

let appInstance: FirebaseApp | null = null;

if (browser) {
  try {
    if (!PUBLIC_FIREBASE_API_KEY || !PUBLIC_FIREBASE_PROJECT_ID) {
      throw new Error("Missing PUBLIC_FIREBASE_* values in admin/.env");
    }
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  } catch (error) {
    firebaseInitError = error instanceof Error ? error.message : "Firebase failed to initialize";
    console.error("Firebase init error:", error);
  }
}

export const app: FirebaseApp | null = appInstance;
export const auth: Auth | null = appInstance ? getAuth(appInstance) : null;
export const db: Firestore | null = appInstance ? getFirestore(appInstance) : null;
export const storage: FirebaseStorage | null = appInstance ? getStorage(appInstance) : null;
