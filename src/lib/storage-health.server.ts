import "@tanstack/react-start/server-only";

const TTL_MS = 10 * 60_000;
let cached: { at: number; value: boolean } | null = null;

/**
 * Is Cloud Storage usable? On the Spark plan (since Feb 2026) there is no bucket and every
 * call returns 402/403, so upload controls should say so up front instead of failing after
 * the user picks a file. Cached for 10 minutes; any error counts as "not available".
 */
export async function storageAvailable(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let value = false;
  try {
    const { adminStorage } = await import("@/lib/firebase/admin.server");
    const [exists] = await adminStorage().bucket().exists();
    value = exists;
  } catch {
    value = false;
  }
  cached = { at: Date.now(), value };
  return value;
}
