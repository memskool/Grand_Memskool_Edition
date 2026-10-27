import "@tanstack/react-start/server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin.server";
import { adminGetById, adminSet } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { GoldClass, GoldTutor } from "./types";

const OPS = "ops";
const CATALOG_ID = "gold_catalog";

type Catalog = {
  tutor_ids?: string[];
  class_ids?: string[];
};

export async function loadGoldCatalog(): Promise<{ tutorIds: string[]; classIds: string[] }> {
  const row = await adminGetById<Catalog>(OPS, CATALOG_ID);
  return {
    tutorIds: Array.isArray(row?.tutor_ids) ? row.tutor_ids.filter(Boolean) : [],
    classIds: Array.isArray(row?.class_ids) ? row.class_ids.filter(Boolean) : [],
  };
}

export async function rememberGoldTutor(tutorId: string): Promise<void> {
  await adminSet(
    OPS,
    CATALOG_ID,
    {
      tutor_ids: FieldValue.arrayUnion(tutorId),
      updated_at: new Date().toISOString(),
    },
    true,
  );
}

export async function forgetGoldTutor(tutorId: string): Promise<void> {
  await adminSet(
    OPS,
    CATALOG_ID,
    {
      tutor_ids: FieldValue.arrayRemove(tutorId),
      updated_at: new Date().toISOString(),
    },
    true,
  );
}

export async function rememberGoldClass(classId: string): Promise<void> {
  await adminSet(
    OPS,
    CATALOG_ID,
    {
      class_ids: FieldValue.arrayUnion(classId),
      updated_at: new Date().toISOString(),
    },
    true,
  );
}

export async function forgetGoldClass(classId: string): Promise<void> {
  await adminSet(
    OPS,
    CATALOG_ID,
    {
      class_ids: FieldValue.arrayRemove(classId),
      updated_at: new Date().toISOString(),
    },
    true,
  );
}

export async function loadGoldTutorsByIds(ids: string[]): Promise<GoldTutor[]> {
  if (ids.length === 0) return [];
  const refs = ids.slice(0, 80).map((id) => adminDb().collection(COLLECTIONS.goldTutors).doc(id));
  const snaps = await adminDb().getAll(...refs);
  return snaps
    .filter((snap) => snap.exists && snap.get("status") === "approved")
    .map((snap) => ({ ...(snap.data() as GoldTutor), id: snap.id }));
}

export async function loadGoldClassesByIds(ids: string[]): Promise<GoldClass[]> {
  if (ids.length === 0) return [];
  const refs = ids.slice(0, 80).map((id) => adminDb().collection(COLLECTIONS.goldClasses).doc(id));
  const snaps = await adminDb().getAll(...refs);
  return snaps
    .filter((snap) => snap.exists && snap.get("status") === "published")
    .map((snap) => ({ ...(snap.data() as GoldClass), id: snap.id }));
}
