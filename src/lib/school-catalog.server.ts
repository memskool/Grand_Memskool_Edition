import "@tanstack/react-start/server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminCol, adminGetById, adminListAll } from "@/lib/firebase/admin-repo";
import { adminDb, getAdminApp } from "@/lib/firebase/admin.server";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { FIRESTORE_DATABASE_ID } from "@/lib/firebase/config";
import { schoolCodeKey } from "@/lib/school-ids";

const CATALOG_COLLECTION = "ops";
const CATALOG_ID = "school_catalog";
/** Public, single-doc index — readable with a document get (no collection list / RunQuery). */
export const DIRECTORY_INDEX_ID = "__index";

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

type DirectoryIndex = {
  school_ids?: string[];
  codes?: string[];
  updated_at?: string;
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

/** Keep durable indexes so discovery works without collection listDocuments/RunQuery. */
export async function rememberSchoolInCatalog(
  schoolId: string,
  code?: string | null,
): Promise<void> {
  if (!schoolId) return;
  const now = new Date().toISOString();
  await adminCol(CATALOG_COLLECTION)
    .doc(CATALOG_ID)
    .set(
      {
        school_ids: FieldValue.arrayUnion(schoolId),
        updated_at: now,
      },
      { merge: true },
    );

  const indexPayload: Record<string, unknown> = {
    school_ids: FieldValue.arrayUnion(schoolId),
    updated_at: now,
  };
  if (code?.trim()) {
    indexPayload["codes"] = FieldValue.arrayUnion(schoolCodeKey(code));
  }
  await adminCol(COLLECTIONS.schoolDirectory).doc(DIRECTORY_INDEX_ID).set(indexPayload, {
    merge: true,
  });
}

export async function forgetSchoolInCatalog(schoolId: string, code?: string | null): Promise<void> {
  if (!schoolId) return;
  const now = new Date().toISOString();
  await adminCol(CATALOG_COLLECTION)
    .doc(CATALOG_ID)
    .set(
      {
        school_ids: FieldValue.arrayRemove(schoolId),
        updated_at: now,
      },
      { merge: true },
    );
  const indexPayload: Record<string, unknown> = {
    school_ids: FieldValue.arrayRemove(schoolId),
    updated_at: now,
  };
  if (code?.trim()) {
    indexPayload["codes"] = FieldValue.arrayRemove(schoolCodeKey(code));
  }
  await adminCol(COLLECTIONS.schoolDirectory).doc(DIRECTORY_INDEX_ID).set(indexPayload, {
    merge: true,
  });
}

export async function loadDiscoverableSchoolsByIds(ids: string[]): Promise<DiscoverableSchool[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return [];
  const refs = unique.map((id) => adminCol(COLLECTIONS.schools).doc(id));
  const snaps = await adminDb().getAll(...refs);
  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => mapSchool(snap.id, snap.data() as SchoolDoc))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadFromDirectoryCodes(codes: string[]): Promise<DiscoverableSchool[]> {
  const unique = [...new Set(codes.map((c) => schoolCodeKey(c)).filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return [];
  const refs = unique.map((code) => adminCol(COLLECTIONS.schoolDirectory).doc(code));
  const snaps = await adminDb().getAll(...refs);
  const schoolIds: string[] = [];
  const directoryOnly: DiscoverableSchool[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as {
      school_id?: string;
      name?: string;
      city?: string | null;
      country?: string | null;
      category?: string;
    };
    const schoolId = String(data.school_id || "");
    if (schoolId) schoolIds.push(schoolId);
    else {
      directoryOnly.push(
        mapSchool(snap.id, {
          name: data.name || "School",
          category: data.category || "secondary",
          city: data.city ?? null,
          country: data.country ?? null,
          admissions_open: true,
          code: snap.id,
        }),
      );
    }
  }
  const fromSchools = await loadDiscoverableSchoolsByIds(schoolIds);
  if (fromSchools.length > 0) return fromSchools;
  return directoryOnly.sort((a, b) => a.name.localeCompare(b.name));
}

async function listCollectionViaRest(
  collectionId: string,
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const app = getAdminApp();
  const projectId =
    (typeof app.options.projectId === "string" && app.options.projectId) ||
    process.env["VITE_FIREBASE_PROJECT_ID"] ||
    "memskool-4e193";
  const credential = app.options.credential;
  if (!credential || typeof credential.getAccessToken !== "function") {
    throw new Error("No admin credential available for Firestore REST list.");
  }
  const { access_token } = await credential.getAccessToken();
  if (!access_token) throw new Error("Could not mint an access token for Firestore REST list.");

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/${collectionId}`,
  );
  url.searchParams.set("pageSize", "100");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Firestore REST list ${collectionId} failed: ${response.status} ${body.slice(0, 200)}`,
    );
  }
  const json = (await response.json()) as {
    documents?: Array<{
      name?: string;
      fields?: Record<
        string,
        {
          stringValue?: string;
          booleanValue?: boolean;
          integerValue?: string;
          nullValue?: unknown;
          arrayValue?: { values?: Array<{ stringValue?: string }> };
        }
      >;
    }>;
  };
  return (json.documents ?? []).map((doc) => {
    const id =
      String(doc.name || "")
        .split("/")
        .pop() || "";
    const fields = doc.fields ?? {};
    const out: Record<string, unknown> & { id: string } = { id };
    for (const [key, value] of Object.entries(fields)) {
      if (!value || typeof value !== "object") continue;
      if ("stringValue" in value) out[key] = value.stringValue;
      else if ("booleanValue" in value) out[key] = value.booleanValue;
      else if ("integerValue" in value) out[key] = Number(value.integerValue);
      else if ("nullValue" in value) out[key] = null;
      else if ("arrayValue" in value) {
        out[key] = (value.arrayValue?.values ?? [])
          .map((v) => v.stringValue)
          .filter((v): v is string => typeof v === "string");
      }
    }
    return out;
  });
}

/**
 * Public directory of schools for Dream School (students / parents) and platform operators.
 * Institution workspaces must not use this list — they only manage their own school.
 * Prefer single-document indexes and getAll — avoid Enterprise RunQuery.
 */
export async function listDiscoverableSchools(): Promise<DiscoverableSchool[]> {
  const ids = new Set<string>();

  try {
    const index = await adminGetById<DirectoryIndex>(
      COLLECTIONS.schoolDirectory,
      DIRECTORY_INDEX_ID,
    );
    for (const id of index?.school_ids ?? []) if (id) ids.add(id);
    if (index?.codes?.length) {
      const fromCodes = await loadFromDirectoryCodes(index.codes);
      for (const row of fromCodes) ids.add(row.id);
    }
  } catch (error) {
    console.error("[schools] directory __index lookup failed:", error);
  }

  try {
    const catalog = await adminGetById<{ school_ids?: string[] }>(CATALOG_COLLECTION, CATALOG_ID);
    for (const id of catalog?.school_ids ?? []) if (id) ids.add(id);
  } catch (error) {
    console.error("[schools] catalog lookup failed:", error);
  }

  try {
    const rows = await adminListAll<SchoolDoc>(COLLECTIONS.schools, 100);
    for (const row of rows) if (row.id) ids.add(row.id);
  } catch (error) {
    console.error("[schools] listing schools collection failed:", error);
    try {
      const restSchools = await listCollectionViaRest(COLLECTIONS.schools);
      for (const row of restSchools) {
        if (row.id && row.id !== DIRECTORY_INDEX_ID) ids.add(String(row.id));
      }
    } catch (restError) {
      console.error("[schools] REST schools list failed:", restError);
    }
  }

  try {
    const restDirs = await listCollectionViaRest(COLLECTIONS.schoolDirectory);
    for (const row of restDirs) {
      if (!row.id || row.id === DIRECTORY_INDEX_ID) continue;
      const schoolId = String(row["school_id"] || "");
      if (schoolId) ids.add(schoolId);
    }
  } catch (error) {
    console.error("[schools] REST directory list failed:", error);
  }

  const loaded = await loadDiscoverableSchoolsByIds([...ids]);
  for (const row of loaded) {
    void rememberSchoolInCatalog(row.id, row.code).catch(() => undefined);
  }
  return loaded.sort((a, b) => a.name.localeCompare(b.name));
}
