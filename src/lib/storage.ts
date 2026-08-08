import { supabase } from "@/integrations/supabase/client";

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
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
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
  return `${prefix}/${crypto.randomUUID()}-${safe}`;
}

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string;
const SUPABASE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

/**
 * Uploads through the Storage REST endpoint with XHR so we can report
 * real byte-level progress (the JS SDK does not expose upload progress).
 */
export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You need to be signed in to upload files.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("content-type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = parsed.message ?? parsed.error ?? message;
      } catch {
        /* keep default message */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.send(file);
  });
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("Could not create a download link.");
  return data.signedUrl;
}

export async function downloadObject(bucket: string, path: string, fileName?: string | null) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error("Download failed.");
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName ?? path.split("/").pop() ?? "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
