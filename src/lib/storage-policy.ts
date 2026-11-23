/**
 * Who may read, write or delete a stored file — the same rules as `storage.rules`,
 * as plain code so the server enforces them whichever provider holds the bytes
 * (Firebase Storage or Supabase Storage). Keep both in sync.
 */

export type StorageOp = "read" | "write" | "delete";

export type StorageActor = {
  userId: string;
  role: string;
  /** Token `schoolId` claim (tenancy comes from claims only, as in the rules). */
  schoolId: string | null;
};

export type WriteMeta = { size: number; contentType: string };

const MB = 1024 * 1024;
const STAFF = new Set(["teacher", "admin", "institution", "superadmin"]);

const EDUCATION_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function isEducationFile(type: string) {
  return (
    type.startsWith("image/") ||
    type.startsWith("video/") ||
    type.startsWith("audio/") ||
    EDUCATION_TYPES.has(type)
  );
}

/** Rejects traversal, empty segments and absurd lengths before any rule runs. */
export function isSafeObjectPath(path: string): boolean {
  if (!path || path.length > 512 || path.startsWith("/") || path.endsWith("/")) return false;
  return path.split("/").every((seg) => seg.length > 0 && seg !== "." && seg !== "..");
}

export type Decision = { ok: true } | { ok: false; reason: string };
const allow: Decision = { ok: true };
const deny = (reason: string): Decision => ({ ok: false, reason });

export function authorizeStorage(
  actor: StorageActor,
  path: string,
  op: StorageOp,
  meta?: WriteMeta,
): Decision {
  if (!isSafeObjectPath(path)) return deny("That file path is not allowed.");
  const seg = path.split("/");
  const me = actor.userId;
  const staff = STAFF.has(actor.role);
  const sameSchool = (id: string | undefined) => !!id && actor.schoolId === id;
  const size = meta?.size ?? Number.POSITIVE_INFINITY;
  const type = meta?.contentType ?? "";
  const needMeta = (maxMb: number, typeOk: boolean): Decision =>
    !meta
      ? deny("Missing file details.")
      : size >= maxMb * MB
        ? deny(`Files must be under ${maxMb} MB.`)
        : !typeOk
          ? deny("That type of file is not allowed here.")
          : allow;

  // avatars/{uid}/{file}
  if (seg[0] === "avatars" && seg.length === 3) {
    if (op === "read") return allow;
    if (seg[1] !== me) return deny("You can only change your own photo.");
    return op === "write" ? needMeta(5, type.startsWith("image/")) : allow;
  }

  // users/{uid}/locker/** and users/{uid}/ai-uploads/**
  if (seg[0] === "users" && (seg[2] === "locker" || seg[2] === "ai-uploads") && seg.length >= 4) {
    if (seg[1] !== me) return deny("That file belongs to someone else.");
    return op === "write" ? needMeta(50, isEducationFile(type)) : allow;
  }

  // schools/{sid}/submissions/{studentId}/**
  if (seg[0] === "schools" && seg[2] === "submissions" && seg.length >= 5) {
    if (!sameSchool(seg[1])) return deny("That file is in another school.");
    const owner = seg[3] === me;
    if (op === "read" || op === "delete") return owner || staff ? allow : deny("Not your work.");
    return owner
      ? needMeta(50, isEducationFile(type))
      : deny("You can only hand in your own work.");
  }

  // schools/{sid}/(assignments|lessons|resources)/**
  if (
    seg[0] === "schools" &&
    (seg[2] === "assignments" || seg[2] === "lessons" || seg[2] === "resources") &&
    seg.length >= 4
  ) {
    if (!sameSchool(seg[1])) return deny("That file is in another school.");
    if (op === "read") return allow;
    if (!staff) return deny("Only school staff can change these files.");
    return op === "write" ? needMeta(50, isEducationFile(type)) : allow;
  }

  // home/{uid}/{videoId}/{file}
  if (seg[0] === "home" && seg.length === 4) {
    const owner = seg[1] === me;
    if (op === "read") return owner || actor.role === "superadmin" ? allow : deny("Private video.");
    if (!owner) return deny("Only the uploader can change this video.");
    return op === "write"
      ? needMeta(
          80,
          type.startsWith("video/") ||
            type.startsWith("image/") ||
            type === "text/vtt" ||
            type === "text/plain",
        )
      : allow;
  }

  // gold/{tutorId}/**
  if (seg[0] === "gold" && seg.length >= 3) {
    const owner = seg[1] === me;
    if (op === "read") return owner || actor.role === "superadmin" ? allow : deny("Private file.");
    if (!owner) return deny("Only the tutor can change these files.");
    return op === "write" ? needMeta(50, isEducationFile(type)) : allow;
  }

  // recordings/{sid}/**
  if (seg[0] === "recordings" && seg.length >= 3) {
    if (!sameSchool(seg[1])) return deny("That recording is in another school.");
    if (op === "read") return allow;
    if (!staff) return deny("Only school staff can change recordings.");
    return op === "write" ? needMeta(200, type.startsWith("video/")) : allow;
  }

  return deny("That file location is not allowed.");
}
