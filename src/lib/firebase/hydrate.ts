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
