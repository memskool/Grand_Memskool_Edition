export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export function hasFirebaseWebConfig(): boolean {
  return Boolean(
    import.meta.env["VITE_FIREBASE_API_KEY"] && import.meta.env["VITE_FIREBASE_APP_ID"],
  );
}

function requiredPublic(name: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error(`Missing public Firebase env ${name}. See docs/ENVIRONMENT_SETUP.md.`);
  }
  return value;
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  const measurementId = import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] as string | undefined;
  const base = {
    apiKey: requiredPublic("VITE_FIREBASE_API_KEY"),
    authDomain: requiredPublic("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: requiredPublic("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: requiredPublic("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requiredPublic("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requiredPublic("VITE_FIREBASE_APP_ID"),
  };
  if (measurementId) return { ...base, measurementId };
  return base;
}

export const USE_EMULATORS = import.meta.env["VITE_USE_FIREBASE_EMULATORS"] === "true";

/** Enterprise database id. Must not be `(default)`. Native Firestore API is required. */
export const FIRESTORE_DATABASE_ID = "default";
