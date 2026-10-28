import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getCountFromServer,
  onSnapshot,
  Timestamp,
  documentId,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./client";
import { plainFirestoreData } from "./plain-data";
import { COLLECTIONS, type CollectionName } from "./collections";

export { COLLECTIONS, type CollectionName };

export function col(name: CollectionName) {
  return collection(getDb(), name);
}

export function docRef(name: CollectionName, id: string) {
  return doc(getDb(), name, id);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function withId<T extends DocumentData>(id: string, data: T): T & { id: string } {
  return { ...data, id };
}

export async function getById<T extends DocumentData>(
  name: CollectionName,
  id: string,
): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(docRef(name, id));
  if (!snap.exists()) return null;
  return withId(snap.id, snap.data() as T);
}

export async function findMany<T extends DocumentData>(
  name: CollectionName,
  constraints: QueryConstraint[],
): Promise<Array<T & { id: string }>> {
  const snap = await getDocs(query(col(name), ...constraints));
  return snap.docs.map((d) => withId(d.id, d.data() as T));
}

export async function findOne<T extends DocumentData>(
  name: CollectionName,
  constraints: QueryConstraint[],
): Promise<(T & { id: string }) | null> {
  const rows = await findMany<T>(name, [...constraints, fsLimit(1)]);
  return rows[0] ?? null;
}

export async function createDoc<T extends DocumentData>(
  name: CollectionName,
  data: T,
): Promise<string> {
  const ref = await addDoc(col(name), plainFirestoreData(data as Record<string, unknown>));
  return ref.id;
}

export async function setById<T extends DocumentData>(
  name: CollectionName,
  id: string,
  data: T,
  merge = true,
): Promise<void> {
  await setDoc(docRef(name, id), plainFirestoreData(data as Record<string, unknown>), { merge });
}

export async function patchById(
  name: CollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(docRef(name, id), plainFirestoreData(data));
}

export async function removeById(name: CollectionName, id: string): Promise<void> {
  await deleteDoc(docRef(name, id));
}

export async function countDocs(
  name: CollectionName,
  constraints: QueryConstraint[] = [],
): Promise<number> {
  const snap = await getCountFromServer(query(col(name), ...constraints));
  return snap.data().count;
}

export function subscribeMany<T extends DocumentData>(
  name: CollectionName,
  constraints: QueryConstraint[],
  onNext: (rows: Array<T & { id: string }>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(col(name), ...constraints),
    (snap) => onNext(snap.docs.map((d) => withId(d.id, d.data() as T))),
    (error) => onError?.(error),
  );
}

export { where, orderBy, fsLimit as limit, Timestamp, query, documentId };
