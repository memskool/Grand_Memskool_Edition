import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { adminGetById, adminListAll, adminSet, adminDelete } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { adminAuth } from "@/lib/firebase/admin.server";
import { isSchoolManager, type AppRole } from "@/types/roles";
import { schoolCodeKey } from "@/lib/school-ids";

const optionalText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
});

const optionalMoney = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

const RegisterSchoolSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(40),
  city: optionalText,
  country: z.string().trim().min(1).max(80),
  website: optionalText,
  description: optionalText,
  fees_min: optionalMoney,
  fees_max: optionalMoney,
  badges: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  is_international: z.boolean().default(false),
});

function publicWriteError(error: unknown): Error {
  if (error instanceof Error) {
    const first = error.message.split(/\r?\n/)[0]?.trim() ?? "";
    if (
      first &&
      first.length <= 180 &&
      !first.toLowerCase().includes("firebase") &&
      !first.toLowerCase().includes("firestore") &&
      !first.includes("http")
    ) {
      return new Error(first);
    }
  }
  return new Error("Could not save those school details. Refresh and try again.");
}

async function allocateCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = `MS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const existing = await adminGetById(COLLECTIONS.schoolDirectory, candidate);
    if (!existing) return candidate;
  }
  throw new Error("Could not allocate a School ID. Try again.");
}

export const registerDigitalSchool = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = RegisterSchoolSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(issue?.message ?? "Check the school details and try again.");
    }
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    try {
      const profile = await adminGetById<{
        role?: AppRole;
        school_id?: string | null;
      }>(COLLECTIONS.users, context.userId);
      const role: AppRole =
        isSchoolManager(context.role) || context.role === "superadmin"
          ? context.role
          : profile?.role === "institution" ||
              profile?.role === "admin" ||
              profile?.role === "superadmin"
            ? profile.role
            : context.role;

      if (!isSchoolManager(role) && role !== "superadmin") {
        throw new Error("You do not have permission to register a school.");
      }

      const now = new Date().toISOString();
      const owned = await adminGetById(COLLECTIONS.schools, context.userId);
      const existingId =
        role === "superadmin"
          ? null
          : context.schoolId || profile?.school_id || (owned ? context.userId : null);
      const existing = existingId
        ? await adminGetById<{
            code?: string;
            owner_id?: string;
            created_at?: string;
            admissions_open?: boolean;
            contact_email?: string | null;
            logo_url?: string | null;
          }>(COLLECTIONS.schools, existingId)
        : owned
          ? { ...owned, id: context.userId }
          : null;

      const schoolId =
        existing?.id ?? (role === "superadmin" ? crypto.randomUUID() : context.userId);
      const code = existing?.code ? String(existing.code) : await allocateCode();

      await adminSet(COLLECTIONS.schools, schoolId, {
        name: data.name,
        code,
        category: data.category,
        city: data.city,
        country: data.country,
        website: data.website,
        description: data.description,
        fees_min: data.fees_min,
        fees_max: data.fees_max,
        fees_currency: "UGX",
        badges: data.badges,
        is_international: data.is_international,
        admissions_open: existing?.admissions_open ?? true,
        contact_email: existing?.contact_email ?? context.email,
        logo_url: existing?.logo_url ?? null,
        owner_id: existing?.owner_id ?? context.userId,
        created_by: context.userId,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
      await adminSet(COLLECTIONS.schoolDirectory, schoolCodeKey(code), {
        school_id: schoolId,
        name: data.name,
        city: data.city,
        country: data.country,
      });

      if (!existing) {
        await adminSet(COLLECTIONS.schoolMembers, context.userId, {
          school_id: schoolId,
          user_id: context.userId,
          role: "institution",
          status: "approved",
          student_code: null,
          created_at: now,
        });
        await adminSet(COLLECTIONS.users, context.userId, {
          school_id: schoolId,
          membership_status: "owner",
          updated_at: now,
        });
        if (role !== "superadmin") {
          await adminAuth().setCustomUserClaims(context.userId, {
            role: "admin",
            schoolId,
            approved: true,
          });
        }
      }

      return { schoolId, code };
    } catch (error) {
      throw publicWriteError(error);
    }
  });

export const listDirectorySchools = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async () => {
    try {
      const rows = await adminListAll<{
        school_id?: string;
        name?: string;
        city?: string | null;
        country?: string | null;
      }>(COLLECTIONS.schoolDirectory, 80);
      return rows.map((row) => ({
        id: String(row.school_id || row.id),
        name: String(row.name || "School"),
        category: "secondary",
        country: row.country ? String(row.country) : "",
        city: row.city ?? null,
        description: null,
        website: null,
        logo_url: null,
        fees_min: null,
        fees_max: null,
        fees_currency: "UGX",
        fees_notes: null,
        badges: [] as string[],
        is_international: false,
        admissions_open: true,
        contact_email: null,
        created_at: "",
      }));
    } catch (error) {
      throw publicWriteError(error);
    }
  });

export const deleteDigitalSchool = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ schoolId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const school = await adminGetById<{ owner_id?: string; code?: string }>(
        COLLECTIONS.schools,
        data.schoolId,
      );
      if (!school) throw new Error("That school was not found.");
      const owns = school.owner_id === context.userId || context.schoolId === data.schoolId;
      if (context.role !== "superadmin" && !(isSchoolManager(context.role) && owns)) {
        throw new Error("You do not have permission to perform this action.");
      }

      if (school.code) {
        const dir = await adminGetById<{ school_id?: string }>(
          COLLECTIONS.schoolDirectory,
          schoolCodeKey(String(school.code)),
        );
        if (dir?.school_id === data.schoolId) {
          await adminDelete(COLLECTIONS.schoolDirectory, schoolCodeKey(String(school.code)));
        }
      }
      await adminDelete(COLLECTIONS.schools, data.schoolId);

      if (context.role !== "superadmin" && context.schoolId === data.schoolId) {
        const now = new Date().toISOString();
        await adminSet(COLLECTIONS.users, context.userId, {
          school_id: null,
          membership_status: "approved",
          updated_at: now,
        });
        await adminAuth().setCustomUserClaims(context.userId, {
          role: "admin",
          schoolId: null,
          approved: true,
        });
      }

      return { ok: true as const };
    } catch (error) {
      throw publicWriteError(error);
    }
  });
