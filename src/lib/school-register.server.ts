import "@tanstack/react-start/server-only";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import { adminGetById, adminSet, adminDelete } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { adminAuth } from "@/lib/firebase/admin.server";
import { isSchoolManager, type AppRole } from "@/types/roles";
import { schoolCodeKey } from "@/lib/school-ids";
import { looksLikeHtmlError } from "@/lib/errors/app-error";
import { toClientJson } from "@/lib/firebase/plain-data";
import {
  forgetSchoolInCatalog,
  listDiscoverableSchools,
  loadDiscoverableSchoolsByIds,
  rememberSchoolInCatalog,
} from "@/lib/school-catalog.server";
import { rememberUserDirectory } from "@/features/auth/services/session-account.server";
import { resolveOwnedSchoolId } from "@/lib/school-ownership";

export type RegisterSchoolInput = {
  name: string;
  category: string;
  city: string | null;
  country: string;
  website: string | null;
  description: string | null;
  fees_min: number | null;
  fees_max: number | null;
  badges: string[];
  is_international: boolean;
  admissions_open?: boolean | undefined;
};

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

function actingSchoolRole(
  jwtRole: AppRole,
  profileRole: AppRole | undefined,
  hasProfile: boolean,
): AppRole {
  if (isSchoolManager(jwtRole) || jwtRole === "superadmin") return jwtRole;
  if (profileRole && (isSchoolManager(profileRole) || profileRole === "superadmin")) {
    return profileRole;
  }
  // Signup often seeds the UI as institution before custom claims exist. This
  // RPC is the only way to register a school — allow a first-time account.
  if (!hasProfile) return "institution";
  return jwtRole;
}

export async function registerDigitalSchoolHandler(
  data: RegisterSchoolInput,
  context: AuthedContext,
) {
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

    const role = actingSchoolRole(context.role, profile?.role, Boolean(profile));
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

    const saved = await adminGetById<{ name?: string }>(COLLECTIONS.schools, schoolId);
    if (!saved?.name) {
      throw new Error("School was not saved. Try again.");
    }

    await adminSet(COLLECTIONS.schoolDirectory, schoolCodeKey(code), {
      school_id: schoolId,
      name: data.name,
      city: data.city,
      country: data.country,
      category: data.category,
      admissions_open: data.admissions_open ?? existing?.admissions_open ?? true,
    });
    try {
      await rememberSchoolInCatalog(schoolId, code);
    } catch (catalogError) {
      console.error("[registerDigitalSchool] catalog", catalogError);
    }

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
    try {
      await rememberUserDirectory(profile?.email ?? context.email, context.userId, {
        role: storedRole,
        schoolId,
      });
    } catch (directoryError) {
      console.error("[registerDigitalSchool] directory", directoryError);
    }
    if (role !== "superadmin") {
      try {
        await adminAuth().setCustomUserClaims(context.userId, {
          role: "admin",
          schoolId,
          approved: true,
        });
      } catch (claimsError) {
        console.error("[registerDigitalSchool] claims", claimsError);
      }
    }

    return toClientJson({
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
    });
  } catch (error) {
    throw publicWriteError(error);
  }
}

export async function listDirectorySchoolsHandler(context: AuthedContext) {
  try {
    if (isSchoolManager(context.role) && context.role !== "superadmin") {
      const ownedAtUid = await adminGetById<{ owner_id?: string }>(
        COLLECTIONS.schools,
        context.userId,
      );
      const profile = await adminGetById<{ school_id?: string | null; role?: AppRole }>(
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
      if (!ownedId && ownedAtUid) {
        return toClientJson(await loadDiscoverableSchoolsByIds([context.userId]));
      }
      if (!ownedId) return [];
      return toClientJson(await loadDiscoverableSchoolsByIds([ownedId]));
    }
    return toClientJson(await listDiscoverableSchools());
  } catch (error) {
    console.error(error);
    throw publicWriteError(error);
  }
}

export async function deleteDigitalSchoolHandler(
  data: { schoolId: string },
  context: AuthedContext,
) {
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
}
