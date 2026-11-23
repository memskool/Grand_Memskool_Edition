import "@tanstack/react-start/server-only";

const TTL_MS = 10 * 60_000;
let cached: { at: number; value: boolean; provider: string } | null = null;

/**
 * Is file storage usable right now, on whichever provider STORAGE_PROVIDER selects?
 * Firebase needs the Blaze plan; Supabase needs SUPABASE_URL + service key. Cached for
 * 10 minutes (per provider); any error counts as "not available".
 */
export async function storageAvailable(): Promise<boolean> {
  const { providerReachable, storageProvider } = await import("@/lib/storage-provider.server");
  const provider = storageProvider();
  if (cached && cached.provider === provider && Date.now() - cached.at < TTL_MS) {
    return cached.value;
  }
  let value = false;
  try {
    value = await providerReachable();
  } catch {
    value = false;
  }
  cached = { at: Date.now(), value, provider };
  return value;
}
