import { getFirebaseAuth } from "@/lib/firebase/client";
import { COLLECTIONS, getById } from "@/lib/firebase/repo";

type SubjectDoc = { name: string; code?: string };
type UserDoc = { full_name: string; email?: string | null; avatar_url?: string | null };

export type ProfileLite = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
};

export async function currentUid(): Promise<string | null> {
  return getFirebaseAuth().currentUser?.uid ?? null;
}

export async function userSchoolId(userId?: string): Promise<string | null> {
  const id = userId ?? (await currentUid());
  if (!id) return null;
  const row = await getById<{ school_id?: string | null }>(COLLECTIONS.users, id);
  return row?.school_id ?? null;
}

const PROFILE_TTL_MS = 5 * 60_000;
const profileCache = new Map<string, { at: number; value: Promise<ProfileLite | null> }>();

/**
 * Cached, de-duplicated profile lookup for realtime lists (chat, participants, DMs).
 * Without it every snapshot re-read one `users/{id}` doc per row, which made a 200-message
 * chat cost 200 reads per new message and lag by seconds.
 */
export function profileLite(userId: string | null | undefined): Promise<ProfileLite | null> {
  if (!userId) return Promise.resolve(null);
  const hit = profileCache.get(userId);
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.value;
  const value = getById<UserDoc>(COLLECTIONS.users, userId)
    .then((user) =>
      user
        ? {
            id: user.id,
            full_name: user.full_name,
            email: user.email ?? null,
            avatar_url: user.avatar_url ?? null,
          }
        : null,
    )
    .catch(() => {
      profileCache.delete(userId);
      return null;
    });
  profileCache.set(userId, { at: Date.now(), value });
  return value;
}

export async function attachSubject<T extends { subject_id?: string | null }>(row: T) {
  const subjectId = row.subject_id;
  const subject = subjectId ? await getById<SubjectDoc>(COLLECTIONS.subjects, subjectId) : null;
  return {
    ...row,
    subject: subject ? { id: subject.id, name: subject.name, code: subject.code ?? "" } : null,
  };
}

export async function attachNamedUser<T extends object>(
  row: T,
  userId: string | null | undefined,
  key: "student",
): Promise<T & { student: ProfileLite | null }>;
export async function attachNamedUser<T extends object>(
  row: T,
  userId: string | null | undefined,
  key: "teacher",
): Promise<T & { teacher: ProfileLite | null }>;
export async function attachNamedUser<T extends object>(
  row: T,
  userId: string | null | undefined,
  key: "sender",
): Promise<T & { sender: ProfileLite | null }>;
export async function attachNamedUser<T extends object>(
  row: T,
  userId: string | null | undefined,
  key: "seller",
): Promise<T & { seller: ProfileLite | null }>;
export async function attachNamedUser<T extends object>(
  row: T,
  userId: string | null | undefined,
  key: "profile",
): Promise<T & { profile: ProfileLite | null }>;
export async function attachNamedUser<T extends object>(
  row: T,
  userId: string | null | undefined,
  key: "student" | "teacher" | "sender" | "profile" | "seller",
) {
  const user = userId ? await getById<UserDoc>(COLLECTIONS.users, userId) : null;
  const profile: ProfileLite | null = user
    ? {
        id: user.id,
        full_name: user.full_name,
        email: user.email ?? null,
        avatar_url: user.avatar_url ?? null,
      }
    : null;
  if (key === "student") return { ...row, student: profile };
  if (key === "teacher") return { ...row, teacher: profile };
  if (key === "sender") return { ...row, sender: profile };
  if (key === "seller") return { ...row, seller: profile };
  return { ...row, profile };
}

export async function attachClassName<T extends { class_id?: string | null }>(row: T) {
  const classId = row.class_id;
  const cls = classId ? await getById<{ name: string }>(COLLECTIONS.classes, classId) : null;
  return { ...row, class: cls ? { id: cls.id, name: cls.name } : null };
}
