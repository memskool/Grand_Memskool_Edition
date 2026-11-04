import "@tanstack/react-start/server-only";
import { FIRESTORE_DATABASE_ID } from "./config";

type FirestoreValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  nullValue?: null;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
};

function decodeValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ("nullValue" in value) return null;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;
  if (typeof value.integerValue === "string") return Number(value.integerValue);
  if (typeof value.doubleValue === "number") return value.doubleValue;
  if (typeof value.timestampValue === "string") return value.timestampValue;
  if (value.mapValue?.fields) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value.mapValue.fields)) {
      out[key] = decodeValue(inner);
    }
    return out;
  }
  if (value.arrayValue?.values) return value.arrayValue.values.map((inner) => decodeValue(inner));
  return null;
}

/**
 * Read a Firestore document as the signed-in user (security rules apply).
 * No firebase-admin — safe on the Vercel ESM server bundle.
 */
export async function getFirestoreDocAsUser<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  idToken: string,
): Promise<(T & { id: string }) | null> {
  const projectId =
    process.env["VITE_FIREBASE_PROJECT_ID"] || process.env["GCLOUD_PROJECT"] || "memskool-4e193";
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}` +
    `/documents/${collection}/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text.includes("PERMISSION_DENIED") || response.status === 403
        ? "You are not allowed to join this class."
        : "Could not load that live session. Try again.",
    );
  }
  const body = (await response.json()) as { fields?: Record<string, FirestoreValue> };
  const fields = body.fields ?? {};
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    data[key] = decodeValue(value);
  }
  return { ...(data as T), id };
}
