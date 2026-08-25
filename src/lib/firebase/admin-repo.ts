import type { DocumentData, Query, WhereFilterOp } from "firebase-admin/firestore";
import { adminDb } from "./admin.server";
import { plainFirestoreData } from "./plain-data";

export function adminCol(name: string) {
  return adminDb().collection(name);
}

export async function adminGetById<T extends DocumentData>(
  name: string,
  id: string,
): Promise<(T & { id: string }) | null> {
  const snap = await adminCol(name).doc(id).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as T), id: snap.id };
}

export async function adminCreate(name: string, data: DocumentData): Promise<string> {
  const ref = await adminCol(name).add(plainFirestoreData(data as Record<string, unknown>));
  return ref.id;
}

export async function adminSet(name: string, id: string, data: DocumentData, merge = true) {
  await adminCol(name)
    .doc(id)
    .set(plainFirestoreData(data as Record<string, unknown>), { merge });
}

export async function adminUpdate(name: string, id: string, data: DocumentData) {
  await adminCol(name)
    .doc(id)
    .update(plainFirestoreData(data as Record<string, unknown>));
}

/** List documents without a RunQuery (Firestore Enterprise). */
export async function adminListAll<T extends DocumentData>(
  name: string,
  max = 80,
): Promise<Array<T & { id: string }>> {
  const refs = await adminCol(name).listDocuments();
  if (refs.length === 0) return [];
  const snaps = await adminDb().getAll(...refs.slice(0, max));
  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => ({ ...(snap.data() as T), id: snap.id }));
}

export async function adminDelete(name: string, id: string) {
  await adminCol(name).doc(id).delete();
}

export async function adminWhere<T extends DocumentData>(
  name: string,
  field: string,
  op: WhereFilterOp,
  value: unknown,
  extra?: Array<[string, WhereFilterOp, unknown]>,
): Promise<Array<T & { id: string }>> {
  let q: Query = adminCol(name).where(field, op, value);
  for (const [f, o, v] of extra ?? []) q = q.where(f, o, v);
  const snap = await q.get();
  return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
}

export async function adminIsSuspended(userId: string): Promise<boolean> {
  const rows = await adminWhere<{
    kind: string;
    active: boolean;
    starts_at?: string;
    ends_at?: string | null;
  }>("disciplinary_actions", "student_id", "==", userId, [
    ["kind", "==", "suspension"],
    ["active", "==", true],
  ]);
  const now = Date.now();
  return rows.some((a) => {
    const start = a.starts_at ? new Date(a.starts_at).getTime() : 0;
    const end = a.ends_at ? new Date(a.ends_at).getTime() : Number.POSITIVE_INFINITY;
    return start <= now && now < end;
  });
}
