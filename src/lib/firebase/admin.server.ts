import "@tanstack/react-start/server-only";
import "@/lib/node-esm-globals";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { initializeApp, getApps, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import { FIRESTORE_DATABASE_ID } from "./config";

const PROJECT_ID =
  process.env["VITE_FIREBASE_PROJECT_ID"] || process.env["GCLOUD_PROJECT"] || "memskool-4e193";

/** JSON object string, or a path to a service-account .json file. Never a VITE_ var. */
function loadServiceAccount(): Record<string, unknown> | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"]?.trim();
  if (!raw) return null;
  let source = raw;
  if (!raw.startsWith("{")) {
    // A file path only works locally. On the host the key file is git-ignored and never
    // deployed, so say so instead of surfacing a bare ENOENT from deep inside the SDK.
    const file = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
    if (!existsSync(file)) {
      throw new Error(
        "Memskool could not finish signup because the live server is missing Firebase admin credentials: " +
          "FIREBASE_SERVICE_ACCOUNT_JSON points to a file that does not exist on the server. " +
          "Set it to the service-account JSON itself (one line), not a file path.",
      );
    }
    source = readFileSync(file, "utf8");
  }
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
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp(), FIRESTORE_DATABASE_ID);
}

export function adminStorage() {
  return getStorage(getAdminApp());
}

export function adminMessaging() {
  return getMessaging(getAdminApp());
}

/** Phase 9: sensitive RPCs reject revoked sessions (checkRevoked). */
export async function verifyIdToken(token: string) {
  return adminAuth().verifyIdToken(token, true);
}
