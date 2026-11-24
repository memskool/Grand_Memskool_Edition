import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";
import { AppError } from "@/lib/errors/app-error";
import { getPlatformCapabilities } from "@/lib/capabilities.functions";
import { deleteStoredFile, getStoredFileUrl, prepareUpload } from "@/lib/storage.functions";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export type FileCategory = "note" | "video" | "audio";

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  note: "Notes",
  video: "Videos",
  audio: "Audio",
};

export function formatBytes(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function inferCategory(file: File): FileCategory {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "note";
}

export function validateFile(file: File): string | null {
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  return null;
}

export function buildObjectPath(prefix: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-120);
  return `${prefix}/${crypto.randomUUID()}-${safe}`;
}

/** Maps legacy bucket+path calls onto Firebase Storage object paths. */
export function storageObjectPath(bucket: string, path: string): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (bucket === "locker-files") {
    if (path.startsWith("users/")) return path;
    return uid ? `users/${uid}/locker/${path}` : path;
  }
  if (bucket === "library-files") {
    if (path.startsWith("schools/")) return path;
    return path;
  }
  return path;
}

/** Firebase Storage SDK, loaded only when a file is actually uploaded or opened. */
async function fbStorage() {
  const [sdk, storage] = await Promise.all([import("firebase/storage"), getFirebaseStorage()]);
  return { ...sdk, storage };
}

/* ------------------------------------------------------------------ */
/* Provider switch (Firebase Storage ⇄ Supabase Storage)                 */
/* ------------------------------------------------------------------ */

type Provider = "firebase" | "supabase";
let providerPromise: Promise<Provider> | null = null;

/** Which backend holds files, as the server reports it (STORAGE_PROVIDER). Cached per load. */
function activeProvider(): Promise<Provider> {
  providerPromise ??= getPlatformCapabilities()
    .then((c) => (c.storageProvider === "supabase" ? "supabase" : "firebase") as Provider)
    .catch(() => {
      providerPromise = null;
      return "firebase" as Provider;
    });
  return providerPromise;
}

/** Browser → Supabase signed upload URL, with progress (same form as supabase-js). */
function putToSignedUrl(url: string, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      const tooBig =
        xhr.status === 413 || /exceeded the maximum allowed size/i.test(xhr.responseText);
      reject(
        tooBig
          ? new AppError("validation", "That file is larger than the storage limit (50 MB).")
          : new AppError("network", "The upload did not finish. Try again."),
      );
    };
    xhr.onerror = () =>
      reject(new AppError("network", "The upload was interrupted. Check your connection."));
    xhr.send(form);
  });
}

function requireUser(message: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AppError("auth", message);
  return user;
}

/**
 * Uploads bytes to `objectPath` on the active provider. Returns the public URL for
 * public objects (avatars on Supabase), otherwise null. Paths are provider-neutral.
 */
export async function uploadObject(
  objectPath: string,
  file: File,
  opts: { onProgress?: (percent: number) => void; contentType?: string } = {},
): Promise<string | null> {
  requireUser("You need to be signed in to upload files.");
  const contentType = file.type || opts.contentType || "application/octet-stream";
  if ((await activeProvider()) === "supabase") {
    const target = await prepareUpload({
      data: { path: objectPath, size: file.size, contentType },
    });
    if (target.provider === "supabase") {
      await putToSignedUrl(target.uploadUrl, file, opts.onProgress);
      opts.onProgress?.(100);
      return target.publicUrl;
    }
  }
  const { ref, uploadBytesResumable, storage } = await fbStorage();
  const storageRef = ref(storage, objectPath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType });
    task.on(
      "state_changed",
      (snap) => {
        if (snap.totalBytes > 0) {
          opts.onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (error) => reject(error),
      () => {
        opts.onProgress?.(100);
        resolve();
      },
    );
  });
  return null;
}

/** A link that opens the file (short-lived on Supabase / signed on Firebase). */
export async function getObjectUrl(objectPath: string): Promise<string> {
  if ((await activeProvider()) === "supabase") {
    return (await getStoredFileUrl({ data: { path: objectPath } })).url;
  }
  const { ref, getDownloadURL, storage } = await fbStorage();
  return getDownloadURL(ref(storage, objectPath));
}

export async function deleteStoredObject(objectPath: string): Promise<void> {
  if ((await activeProvider()) === "supabase") {
    await deleteStoredFile({ data: { path: objectPath } });
    return;
  }
  const { ref, deleteObject, storage } = await fbStorage();
  await deleteObject(ref(storage, objectPath));
}

/* ------------------------------------------------------------------ */
/* Existing call-site API (unchanged signatures)                        */
/* ------------------------------------------------------------------ */

export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await uploadObject(storageObjectPath(bucket, path), file, onProgress ? { onProgress } : {});
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  _expiresIn = 3600,
): Promise<string> {
  void _expiresIn;
  return getObjectUrl(storageObjectPath(bucket, path));
}

export async function downloadObject(bucket: string, path: string, fileName?: string | null) {
  const objectPath = storageObjectPath(bucket, path);
  const blob =
    (await activeProvider()) === "supabase"
      ? await fetch(await getObjectUrl(objectPath)).then((r) => {
          if (!r.ok) throw new AppError("not_found", "That file could not be found.");
          return r.blob();
        })
      : await fbStorage().then(({ ref, getBlob, storage }) => getBlob(ref(storage, objectPath)));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName ?? path.split("/").pop() ?? "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function removeObject(bucket: string, path: string) {
  await deleteStoredObject(storageObjectPath(bucket, path));
}

const AVATAR_MAX = 5 * 1024 * 1024;

export async function getSchoolObjectUrl(objectPath: string): Promise<string> {
  return getObjectUrl(objectPath);
}

export async function uploadSchoolObject(objectPath: string, file: File): Promise<string> {
  requireUser("You need to be signed in to upload files.");
  const err = validateFile(file);
  if (err) throw new AppError("validation", err);
  await uploadObject(objectPath, file);
  return objectPath;
}

export async function uploadAvatar(file: File): Promise<string> {
  const user = requireUser("You need to be signed in to update your photo.");
  if (!file.type.startsWith("image/")) throw new AppError("validation", "Choose an image file.");
  if (file.size > AVATAR_MAX) throw new AppError("validation", "Photos must be 5 MB or smaller.");
  const path = `avatars/${user.uid}/profile`;
  const publicUrl = await uploadObject(path, file, { contentType: "image/jpeg" });
  // Supabase avatars live in a public bucket; ?v= busts caches after a new photo.
  if (publicUrl) return `${publicUrl}?v=${Date.now()}`;
  const { ref, getDownloadURL, storage } = await fbStorage();
  return getDownloadURL(ref(storage, path));
}
