import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { adminGetById, adminSet, adminDelete } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { adminAuth } from "@/lib/firebase/admin.server";
import { isSchoolManager, type AppRole } from "@/types/roles";
import { schoolCodeKey } from "@/lib/school-ids";
import { looksLikeHtmlError } from "@/lib/errors/app-error";
import {
  forgetSchoolInCatalog,
  listDiscoverableSchools,
  loadDiscoverableSchoolsByIds,
  rememberSchoolInCatalog,
} from "@/lib/school-catalog.server";
import { rememberUserDirectory } from "@/features/auth/services/session-account.server";
import { resolveOwnedSchoolId } from "@/lib/school-ownership";

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
  admissions_open: z.boolean().optional(),
});

function publicWriteError(error: unknown): Error {
  if (error instanceof Error) {
    const first = error.message.split(/\r?\n/)[0]?.trim() ?? "";
    if (
      first &&
      first.length <= 180 &&
      !looksLikeHtmlError(first) &&
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
        full_name?: string | null;
        email?: string | null;
        avatar_url?: string | null;
        phone?: string | null;
        student_code?: string | null;
        created_at?: string;
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
      const ownedAtUid = await adminGetById<{ owner_id?: string }>(
        COLLECTIONS.schools,
        context.userId,
      );
      const profileSchoolId =
        typeof profile?.school_id === "string" && profile.school_id ? profile.school_id : null;
      const profileSchool =
        profileSchoolId && profileSchoolId !== context.userId
          ? await adminGetById<{ owner_id?: string }>(COLLECTIONS.schools, profileSchoolId)
          : null;
      const ownedId = resolveOwnedSchoolId({
        userId: context.userId,
        schoolDocAtUserId: Boolean(ownedAtUid),
        profileSchoolId,
        profileSchoolOwnerId: profileSchool?.owner_id ?? ownedAtUid?.owner_id ?? null,
      });

      // Institution accounts upsert exactly one school (keyed by uid when creating).
      // Never write to a school that merely sits on the current claims after "Open".
      const schoolId = role === "superadmin" ? crypto.randomUUID() : (ownedId ?? context.userId);
      const existing =
        role === "superadmin"
          ? null
          : await adminGetById<{
              code?: string;
              owner_id?: string;
              created_at?: string;
              admissions_open?: boolean;
              contact_email?: string | null;
              logo_url?: string | null;
            }>(COLLECTIONS.schools, schoolId);

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
        admissions_open: data.admissions_open ?? existing?.admissions_open ?? true,
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
        category: data.category,
        admissions_open: data.admissions_open ?? existing?.admissions_open ?? true,
      });
      await rememberSchoolInCatalog(schoolId, code);

      if (!existing) {
        await adminSet(COLLECTIONS.schoolMembers, context.userId, {
          school_id: schoolId,
          user_id: context.userId,
          role: "institution",
          status: "approved",
          student_code: null,
          created_at: now,
        });
      }

      // Always keep a complete profile so IdentityGate does not bounce to onboarding.
      const storedRole: AppRole =
        role === "superadmin" ? "superadmin" : role === "admin" ? "admin" : "institution";
      await adminSet(COLLECTIONS.users, context.userId, {
        full_name:
          (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
          data.name ||
          "School admin",
        email: profile?.email ?? context.email,
        avatar_url: profile?.avatar_url ?? null,
        phone: profile?.phone ?? null,
        school_id: schoolId,
        student_code: profile?.student_code ?? null,
        role: storedRole,
        membership_status: "owner",
        created_at: profile?.created_at ?? now,
        updated_at: now,
      });
      await rememberUserDirectory(profile?.email ?? context.email, context.userId, {
        role: storedRole,
        schoolId,
      });
      if (role !== "superadmin") {
        await adminAuth().setCustomUserClaims(context.userId, {
          role: "admin",
          schoolId,
          approved: true,
        });
      }

      return {
        schoolId,
        code,
        name: data.name,
        category: data.category,
        city: data.city,
        country: data.country,
        website: data.website,
        description: data.description,
        fees_min: data.fees_min,
        fees_max: data.fees_max,
        badges: data.badges,
        is_international: data.is_international,
        admissions_open: data.admissions_open ?? existing?.admissions_open ?? true,
        contact_email: existing?.contact_email ?? context.email,
        owner_id: existing?.owner_id ?? context.userId,
        created_at: existing?.created_at ?? now,
      };
    } catch (error) {
      throw publicWriteError(error);
    }
  });

export const listDirectorySchools = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    try {
      // Institution workspaces only ever see their own school — not the public catalog.
      if (isSchoolManager(context.role) && context.role !== "superadmin") {
        const ownedAtUid = await adminGetById<{ owner_id?: string }>(
          COLLECTIONS.schools,
          context.userId,
        );
        const profile = await adminGetById<{ school_id?: string | null }>(
          COLLECTIONS.users,
          context.userId,
        );
        const profileSchoolId =
          typeof profile?.school_id === "string" && profile.school_id ? profile.school_id : null;
        const profileSchool =
          profileSchoolId && profileSchoolId !== context.userId
            ? await adminGetById<{ owner_id?: string }>(COLLECTIONS.schools, profileSchoolId)
            : null;
        const ownedId = resolveOwnedSchoolId({
          userId: context.userId,
          schoolDocAtUserId: Boolean(ownedAtUid),
          profileSchoolId: profileSchoolId ?? context.schoolId,
          profileSchoolOwnerId: profileSchool?.owner_id ?? ownedAtUid?.owner_id ?? null,
        });
        if (!ownedId) return [];
        return await loadDiscoverableSchoolsByIds([ownedId]);
      }
      return await listDiscoverableSchools();
    } catch (error) {
      console.error(error);
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
      if (context.role !== "superadmin" && school.owner_id !== context.userId) {
        throw new Error("You can only remove the school registered to this account.");
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
      await forgetSchoolInCatalog(data.schoolId, school.code ? String(school.code) : null);

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
