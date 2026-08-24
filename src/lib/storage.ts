import { getDownloadURL, ref, uploadBytesResumable, getBlob, deleteObject } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";
import { AppError } from "@/lib/errors/app-error";

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

export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AppError("auth", "You need to be signed in to upload files.");
  const objectPath = storageObjectPath(bucket, path);
  const storageRef = ref(getFirebaseStorage(), objectPath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || undefined });
    task.on(
      "state_changed",
      (snap) => {
        if (snap.totalBytes > 0) {
          onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (error) => reject(error),
      () => {
        onProgress?.(100);
        resolve();
      },
    );
  });
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  _expiresIn = 3600,
): Promise<string> {
  void _expiresIn;
  return getDownloadURL(ref(getFirebaseStorage(), storageObjectPath(bucket, path)));
}

export async function downloadObject(bucket: string, path: string, fileName?: string | null) {
  const blob = await getBlob(ref(getFirebaseStorage(), storageObjectPath(bucket, path)));
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
  await deleteObject(ref(getFirebaseStorage(), storageObjectPath(bucket, path)));
}

const AVATAR_MAX = 5 * 1024 * 1024;

export async function getSchoolObjectUrl(objectPath: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), objectPath));
}

export async function uploadSchoolObject(objectPath: string, file: File): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AppError("auth", "You need to be signed in to upload files.");
  const err = validateFile(file);
  if (err) throw new AppError("validation", err);
  const storageRef = ref(getFirebaseStorage(), objectPath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || undefined });
    task.on("state_changed", undefined, reject, () => resolve());
  });
  return objectPath;
}

export async function uploadAvatar(file: File): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AppError("auth", "You need to be signed in to update your photo.");
  if (!file.type.startsWith("image/")) throw new AppError("validation", "Choose an image file.");
  if (file.size > AVATAR_MAX) throw new AppError("validation", "Photos must be 5 MB or smaller.");
  const storageRef = ref(getFirebaseStorage(), `avatars/${user.uid}/profile`);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || "image/jpeg" });
    task.on("state_changed", undefined, reject, () => resolve());
  });
  return getDownloadURL(storageRef);
}
