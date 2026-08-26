import "@tanstack/react-start/server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminCol, adminGetById, adminListAll } from "@/lib/firebase/admin-repo";
import { adminDb } from "@/lib/firebase/admin.server";
import { COLLECTIONS } from "@/lib/firebase/repo";

const CATALOG_COLLECTION = "ops";
const CATALOG_ID = "school_catalog";

export type DiscoverableSchool = {
  id: string;
  name: string;
  category: string;
  country: string;
  city: string | null;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  fees_min: number | null;
  fees_max: number | null;
  fees_currency: string;
  fees_notes: string | null;
  badges: string[];
  is_international: boolean;
  admissions_open: boolean;
  contact_email: string | null;
  created_at: string;
  code?: string | null;
};

type SchoolDoc = {
  name?: string;
  category?: string;
  country?: string | null;
  city?: string | null;
  description?: string | null;
  website?: string | null;
  logo_url?: string | null;
  fees_min?: number | null;
  fees_max?: number | null;
  fees_currency?: string;
  fees_notes?: string | null;
  badges?: string[];
  is_international?: boolean;
  admissions_open?: boolean;
  contact_email?: string | null;
  created_at?: string;
  code?: string | null;
};

function mapSchool(id: string, row: SchoolDoc): DiscoverableSchool {
  return {
    id,
    name: String(row.name || "School"),
    category: String(row.category || "secondary"),
    country: row.country ? String(row.country) : "",
    city: row.city ?? null,
    description: row.description ?? null,
    website: row.website ?? null,
    logo_url: row.logo_url ?? null,
    fees_min: typeof row.fees_min === "number" ? row.fees_min : null,
    fees_max: typeof row.fees_max === "number" ? row.fees_max : null,
    fees_currency: row.fees_currency ? String(row.fees_currency) : "UGX",
    fees_notes: row.fees_notes ?? null,
    badges: Array.isArray(row.badges) ? row.badges.map(String) : [],
    is_international: Boolean(row.is_international),
    admissions_open: row.admissions_open !== false,
    contact_email: row.contact_email ?? null,
    created_at: row.created_at ? String(row.created_at) : "",
    code: row.code ?? null,
  };
}

/** Keep a durable index of school ids so discovery works even if listDocuments fails. */
export async function rememberSchoolInCatalog(schoolId: string): Promise<void> {
  if (!schoolId) return;
  await adminCol(CATALOG_COLLECTION)
    .doc(CATALOG_ID)
    .set(
      {
        school_ids: FieldValue.arrayUnion(schoolId),
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
}

export async function forgetSchoolInCatalog(schoolId: string): Promise<void> {
  if (!schoolId) return;
  await adminCol(CATALOG_COLLECTION)
    .doc(CATALOG_ID)
    .set(
      {
        school_ids: FieldValue.arrayRemove(schoolId),
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
}

async function loadByIds(ids: string[]): Promise<DiscoverableSchool[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return [];
  const refs = unique.map((id) => adminCol(COLLECTIONS.schools).doc(id));
  const snaps = await adminDb().getAll(...refs);
  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => mapSchool(snap.id, snap.data() as SchoolDoc))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Public directory of schools for School Admin + Dream School.
 * Prefers the schools collection, then the durable catalog, then school_directory.
 */
export async function listDiscoverableSchools(): Promise<DiscoverableSchool[]> {
  try {
    const rows = await adminListAll<SchoolDoc>(COLLECTIONS.schools, 100);
    if (rows.length > 0) {
      for (const row of rows) {
        void rememberSchoolInCatalog(row.id).catch(() => undefined);
      }
      return rows.map((row) => mapSchool(row.id, row)).sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (error) {
    console.error("[schools] listing schools collection failed:", error);
  }

  try {
    const catalog = await adminGetById<{ school_ids?: string[] }>(CATALOG_COLLECTION, CATALOG_ID);
    const fromCatalog = await loadByIds(catalog?.school_ids ?? []);
    if (fromCatalog.length > 0) return fromCatalog;
  } catch (error) {
    console.error("[schools] catalog lookup failed:", error);
  }

  try {
    const dirs = await adminListAll<{ school_id?: string; name?: string }>(
      COLLECTIONS.schoolDirectory,
      100,
    );
    const ids = dirs.map((d) => String(d.school_id || "")).filter(Boolean);
    const fromDir = await loadByIds(ids);
    if (fromDir.length > 0) {
      for (const id of ids) void rememberSchoolInCatalog(id).catch(() => undefined);
      return fromDir;
    }
    // Directory-only fallback when school docs are missing.
    return dirs
      .map((d) =>
        mapSchool(String(d.school_id || d.id), {
          name: d.name ? String(d.name) : "School",
          category: "secondary",
          admissions_open: true,
        }),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("[schools] directory listing failed:", error);
  }

  return [];
}
