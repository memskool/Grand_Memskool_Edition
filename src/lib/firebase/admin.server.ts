import "@/lib/node-esm-globals";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { FIRESTORE_DATABASE_ID } from "./config";

/**
 * Load firebase-admin via createRequire so Node executes it as CJS.
 * ESM `import "firebase-admin/..."` gets Nitro-bundled and then bare
 * `__dirname` throws ReferenceError on Vercel.
 */
const require = createRequire(import.meta.url);
const adminApp = require("firebase-admin/app") as typeof import("firebase-admin/app");
const adminAuthMod = require("firebase-admin/auth") as typeof import("firebase-admin/auth");
const adminFirestore =
  require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
const adminStorageMod =
  require("firebase-admin/storage") as typeof import("firebase-admin/storage");
const adminMessagingMod =
  require("firebase-admin/messaging") as typeof import("firebase-admin/messaging");

const { initializeApp, getApps, cert, applicationDefault } = adminApp;
type App = import("firebase-admin/app").App;

const PROJECT_ID =
  process.env["VITE_FIREBASE_PROJECT_ID"] || process.env["GCLOUD_PROJECT"] || "memskool-4e193";

/** JSON object string, or a path to a service-account .json file. Never a VITE_ var. */
function loadServiceAccount(): Record<string, unknown> | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"]?.trim();
  if (!raw) return null;
  const source = raw.startsWith("{")
    ? raw
    : readFileSync(isAbsolute(raw) ? raw : resolve(process.cwd(), raw), "utf8");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(source) as Record<string, unknown>;
  } catch {
    throw new Error(
      "Memskool could not finish signup because the live server is missing Firebase admin credentials.",
    );
  }
  if (typeof parsed["private_key"] === "string") {
    parsed["private_key"] = parsed["private_key"].replace(/\\n/g, "\n");
  }
  return parsed;
}

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const emulator = Boolean(
    process.env["FIRESTORE_EMULATOR_HOST"] || process.env["FIREBASE_AUTH_EMULATOR_HOST"],
  );
  if (emulator) {
    return initializeApp({ projectId: PROJECT_ID });
  }

  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    const projectId =
      typeof serviceAccount["project_id"] === "string" ? serviceAccount["project_id"] : PROJECT_ID;
    return initializeApp({
      credential: cert(serviceAccount),
      projectId,
      storageBucket:
        process.env["VITE_FIREBASE_STORAGE_BUCKET"] || `${projectId}.firebasestorage.app`,
    });
  }

  if (process.env["VERCEL"]) {
    throw new Error(
      "Memskool could not finish signup because the live server is missing Firebase admin credentials.",
    );
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
    storageBucket:
      process.env["VITE_FIREBASE_STORAGE_BUCKET"] || `${PROJECT_ID}.firebasestorage.app`,
  });
}

let app: App | undefined;

export function getAdminApp(): App {
  if (!app) app = createAdminApp();
  return app;
}

export function adminAuth() {
  return adminAuthMod.getAuth(getAdminApp());
}

export function adminDb() {
  return adminFirestore.getFirestore(getAdminApp(), FIRESTORE_DATABASE_ID);
}

export function adminStorage() {
  return adminStorageMod.getStorage(getAdminApp());
}

export function adminMessaging() {
  return adminMessagingMod.getMessaging(getAdminApp());
}

export async function verifyIdToken(token: string) {
  return adminAuth().verifyIdToken(token);
}
