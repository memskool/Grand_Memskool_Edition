import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirebaseWebConfig, USE_EMULATORS, FIRESTORE_DATABASE_ID } from "./config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let analytics: Analytics | undefined;
let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps()[0] ?? initializeApp(getFirebaseWebConfig() as FirebaseOptions);
    maybeStartAppCheck(app);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    connectEmulatorsOnce();
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    const app = getFirebaseApp();
    if (typeof window !== "undefined" && !USE_EMULATORS) {
      try {
        db = initializeFirestore(
          app,
          {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          },
          FIRESTORE_DATABASE_ID,
        );
      } catch {
        db = getFirestore(app, FIRESTORE_DATABASE_ID);
      }
    } else {
      db = getFirestore(app, FIRESTORE_DATABASE_ID);
    }
    connectEmulatorsOnce();
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
    connectEmulatorsOnce();
  }
  return storage;
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (analytics) return analytics;
  if (!(await isSupported())) return null;
  analytics = getAnalytics(getFirebaseApp());
  return analytics;
}

function maybeStartAppCheck(instance: FirebaseApp) {
  if (typeof window === "undefined") return;
  const siteKey = import.meta.env["VITE_FIREBASE_APPCHECK_SITE_KEY"] as string | undefined;
  if (!siteKey) return;
  if (import.meta.env.DEV) {
    // Allows local debug tokens when App Check is enforced.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }
  initializeAppCheck(instance, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

function connectEmulatorsOnce() {
  if (!USE_EMULATORS || emulatorsConnected || typeof window === "undefined") return;
  emulatorsConnected = true;
  const authInst = auth ?? getAuth(getFirebaseApp());
  const dbInst = db ?? getFirestore(getFirebaseApp(), FIRESTORE_DATABASE_ID);
  const storageInst = storage ?? getStorage(getFirebaseApp());
  connectAuthEmulator(authInst, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(dbInst, "127.0.0.1", 8080);
  connectStorageEmulator(storageInst, "127.0.0.1", 9199);
}
