import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

export type SchoolLookupResult = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
} | null;

/**
 * Public School-ID lookup. Reads only the directory collection (non-sensitive fields).
 * Uses Admin SDK so the client never needs a public Firestore query for tenancy data
 * beyond what Security Rules also allow on `school_directory`.
 */
export const lookupSchoolByCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(2).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<SchoolLookupResult> => {
    try {
      const { adminDb } = await import("@/lib/firebase/admin.server");
      const code = data.code.trim().toUpperCase();
      const snap = await adminDb().collection("school_directory").doc(code).get();
      if (!snap.exists) return null;
      const row = snap.data();
      if (!row) return null;
      return {
        id: String(row["school_id"] ?? ""),
        name: String(row["name"] ?? ""),
        city: (row["city"] as string | null) ?? null,
        country: (row["country"] as string | null) ?? null,
      };
    } catch {
      throw new Error("Could not verify that School ID right now.");
    }
  });
