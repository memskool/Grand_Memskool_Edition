import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import {
  adminCol,
  adminCreate,
  adminDelete,
  adminGetById,
  adminSet,
} from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { adminAuth } from "@/lib/firebase/admin.server";
import { isSchoolManager } from "@/types/roles";

const RegisterSchoolSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(40),
  city: z.string().trim().max(80).nullable(),
  country: z.string().trim().min(1).max(80),
  website: z.string().trim().max(2048).nullable(),
  description: z.string().trim().max(4000).nullable(),
  fees_min: z.number().finite().nonnegative().nullable(),
  fees_max: z.number().finite().nonnegative().nullable(),
  badges: z.array(z.string().trim().min(1).max(40)).max(12),
  is_international: z.boolean(),
});

function codeKey(code: string): string {
  return code.trim().toUpperCase();
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
  .inputValidator((data: unknown) => RegisterSchoolSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!isSchoolManager(context.role)) {
      throw new Error("You do not have permission to perform this action.");
    }

    const now = new Date().toISOString();
    const existingId = context.role === "superadmin" ? null : context.schoolId;
    const existing = existingId
      ? await adminGetById<{
          code?: string;
          owner_id?: string;
          created_at?: string;
          admissions_open?: boolean;
          contact_email?: string | null;
          logo_url?: string | null;
        }>(COLLECTIONS.schools, existingId)
      : null;

    const schoolId = existing?.id ?? adminCol(COLLECTIONS.schools).doc().id;
    const code = existing?.code ? String(existing.code) : await allocateCode();
    const directoryPayload = {
      school_id: schoolId,
      name: data.name,
      city: data.city,
      country: data.country,
    };

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
    await adminSet(COLLECTIONS.schoolDirectory, codeKey(code), directoryPayload);

    if (!existing) {
      await adminCreate(COLLECTIONS.schoolMembers, {
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
      if (context.role !== "superadmin") {
        await adminAuth().setCustomUserClaims(context.userId, {
          role: "admin",
          schoolId,
          approved: true,
        });
      }
    }

    return { schoolId, code };
  });

export const deleteDigitalSchool = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ schoolId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
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
        codeKey(String(school.code)),
      );
      if (dir?.school_id === data.schoolId) {
        await adminDelete(COLLECTIONS.schoolDirectory, codeKey(String(school.code)));
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
  });
