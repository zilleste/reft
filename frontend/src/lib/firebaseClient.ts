import { browser } from "$app/environment";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

let app: FirebaseApp | null = null;

const cfg = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
} as const;

export function getFirebaseApp(): FirebaseApp {
  if (!browser) {
    throw new Error("Firebase app can only be used in the browser");
  }
  if (app) return app;
  app = getApps().length ? getApps()[0]! : initializeApp(cfg);
  return app;
}
