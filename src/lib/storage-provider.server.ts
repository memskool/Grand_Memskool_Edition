import "@tanstack/react-start/server-only";

/**
 * One storage switch for the whole app (Phase: Supabase Storage trial).
 *
 *   STORAGE_PROVIDER=supabase  + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  → Supabase Storage
 *   STORAGE_PROVIDER=firebase (or unset)                                  → Firebase Storage
 *
 * Object paths are identical under both providers (schools/…, users/…, home/…), and the
 * database only stores paths, so moving back to Firebase after Blaze is: copy the
 * objects (scripts/copy-storage-to-firebase.mjs), then flip STORAGE_PROVIDER.
 *
 * Supabase is reached only from this server, with the service-role key (never VITE_).
 * Browsers get short-lived signed URLs after `authorizeStorage` approves the request.
 */

export type StorageProvider = "firebase" | "supabase";

const PRIVATE_BUCKET_DEFAULT = "memskool";
const PUBLIC_BUCKET_DEFAULT = "memskool-public";

function supabaseEnv() {
  // SUPABASE_STORAGE_URL wins, so an old Lovable-era SUPABASE_URL on Vercel cannot misroute files.
  const url = (process.env["SUPABASE_STORAGE_URL"] || process.env["SUPABASE_URL"])
    ?.trim()
    .replace(/\/+$/, "");
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key) return null;
  return {
    url,
    key,
    bucket: process.env["SUPABASE_STORAGE_BUCKET"]?.trim() || PRIVATE_BUCKET_DEFAULT,
    publicBucket: process.env["SUPABASE_PUBLIC_BUCKET"]?.trim() || PUBLIC_BUCKET_DEFAULT,
  };
}

export function storageProvider(): StorageProvider {
  const wanted = process.env["STORAGE_PROVIDER"]?.trim().toLowerCase();
  return wanted === "supabase" && supabaseEnv() ? "supabase" : "firebase";
}

/** Avatars are the only public objects (profile photos are shown everywhere). */
function isPublicPath(path: string) {
  return path.startsWith("avatars/");
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/* ------------------------------------------------------------------ */
/* Supabase (REST, no SDK)                                             */
/* ------------------------------------------------------------------ */

async function sb(path: string, init: RequestInit & { json?: unknown } = {}) {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase Storage is not configured.");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.key}`,
    apikey: env.key,
    ...(init.headers as Record<string, string> | undefined),
  };
  let body: BodyInit | null = init.body ?? null;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const { json: _json, ...rest } = init;
  void _json;
  return fetch(`${env.url}/storage/v1${path}`, { ...rest, headers, body });
}

function fileSizeLimitBytes() {
  const mb = Number(process.env["SUPABASE_FILE_SIZE_LIMIT_MB"] ?? 50);
  return Math.max(1, Number.isFinite(mb) ? mb : 50) * 1024 * 1024;
}

const ensured = new Set<string>();

async function ensureBucket(id: string, isPublic: boolean) {
  if (ensured.has(id)) return;
  const got = await sb(`/bucket/${encodeURIComponent(id)}`);
  if (got.ok) {
    ensured.add(id);
    return;
  }
  const created = await sb("/bucket", {
    method: "POST",
    // The free Supabase plan caps objects at 50 MB; raise with SUPABASE_FILE_SIZE_LIMIT_MB on Pro.
    json: { id, name: id, public: isPublic, file_size_limit: fileSizeLimitBytes() },
  });
  // 409 = someone else created it meanwhile.
  if (!created.ok && created.status !== 409) {
    throw new Error(`Supabase bucket "${id}" could not be prepared (${created.status}).`);
  }
  ensured.add(id);
}

function bucketFor(path: string) {
  const env = supabaseEnv()!;
  return isPublicPath(path)
    ? { id: env.publicBucket, isPublic: true }
    : { id: env.bucket, isPublic: false };
}

/* ------------------------------------------------------------------ */
/* Provider-neutral operations                                         */
/* ------------------------------------------------------------------ */

export type UploadTarget =
  { provider: "firebase" } | { provider: "supabase"; uploadUrl: string; publicUrl: string | null };

/** Where the browser should send the bytes. Caller must already have authorized. */
export async function createUploadTarget(path: string): Promise<UploadTarget> {
  if (storageProvider() !== "supabase") return { provider: "firebase" };
  const env = supabaseEnv()!;
  const b = bucketFor(path);
  await ensureBucket(b.id, b.isPublic);
  const res = await sb(`/object/upload/sign/${encodeURIComponent(b.id)}/${encodePath(path)}`, {
    method: "POST",
    headers: { "x-upsert": "true" },
    json: {},
  });
  if (!res.ok) throw new Error(`Could not prepare the upload (${res.status}).`);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Could not prepare the upload.");
  return {
    provider: "supabase",
    uploadUrl: `${env.url}/storage/v1${data.url}`,
    publicUrl: b.isPublic
      ? `${env.url}/storage/v1/object/public/${encodeURIComponent(b.id)}/${encodePath(path)}`
      : null,
  };
}

/** Short-lived read link (1 hour by default), or null when the object is missing. */
export async function createReadUrl(path: string, expiresInSec = 3600): Promise<string | null> {
  if (storageProvider() === "supabase") {
    const env = supabaseEnv()!;
    const b = bucketFor(path);
    if (b.isPublic) {
      return `${env.url}/storage/v1/object/public/${encodeURIComponent(b.id)}/${encodePath(path)}`;
    }
    const res = await sb(`/object/sign/${encodeURIComponent(b.id)}/${encodePath(path)}`, {
      method: "POST",
      json: { expiresIn: expiresInSec },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string };
    return data.signedURL ? `${env.url}/storage/v1${data.signedURL}` : null;
  }
  try {
    const { adminStorage } = await import("@/lib/firebase/admin.server");
    const file = adminStorage().bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + expiresInSec * 1000,
    });
    return url;
  } catch {
    return null;
  }
}

/** Size and type of a stored object, or null when it does not exist. */
export async function objectMetadata(
  path: string,
): Promise<{ size: number; contentType: string } | null> {
  if (storageProvider() === "supabase") {
    const b = bucketFor(path);
    const res = await sb(`/object/${encodeURIComponent(b.id)}/${encodePath(path)}`, {
      method: "HEAD",
    });
    if (!res.ok) return null;
    return {
      size: Number(res.headers.get("content-length") ?? 0),
      contentType: res.headers.get("content-type") ?? "",
    };
  }
  try {
    const { adminStorage } = await import("@/lib/firebase/admin.server");
    const file = adminStorage().bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [meta] = await file.getMetadata();
    return { size: Number(meta.size ?? 0), contentType: String(meta.contentType ?? "") };
  } catch {
    return null;
  }
}

export async function deleteObject(path: string): Promise<void> {
  if (storageProvider() === "supabase") {
    const b = bucketFor(path);
    const res = await sb(`/object/${encodeURIComponent(b.id)}`, {
      method: "DELETE",
      json: { prefixes: [path] },
    });
    if (!res.ok && res.status !== 404)
      throw new Error(`Could not delete the file (${res.status}).`);
    return;
  }
  const { adminStorage } = await import("@/lib/firebase/admin.server");
  await adminStorage().bucket().file(path).delete({ ignoreNotFound: true });
}

/** Is the active provider usable right now? (Capabilities / upload controls.) */
export async function providerReachable(): Promise<boolean> {
  if (storageProvider() === "supabase") {
    try {
      const env = supabaseEnv()!;
      await ensureBucket(env.bucket, false);
      await ensureBucket(env.publicBucket, true);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const { adminStorage } = await import("@/lib/firebase/admin.server");
    const [exists] = await adminStorage().bucket().exists();
    return exists;
  } catch {
    return false;
  }
}
