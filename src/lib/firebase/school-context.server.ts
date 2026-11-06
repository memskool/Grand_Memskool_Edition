import "@tanstack/react-start/server-only";
import { adminGetById } from "@/lib/firebase/admin-repo";
import { adminAuth } from "@/lib/firebase/admin.server";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import { isSchoolManager, type AppRole } from "@/types/roles";

/** Resolve the school this operator is managing (claims first, then profile, then schools/{uid}). */
export async function managedSchoolIdFor(context: AuthedContext): Promise<string> {
  if (context.schoolId) return context.schoolId;
  const profile = await adminGetById<{ school_id?: string | null }>(
    COLLECTIONS.users,
    context.userId,
  );
  if (typeof profile?.school_id === "string" && profile.school_id) return profile.school_id;
  const ownedAtUid = await adminGetById(COLLECTIONS.schools, context.userId);
  if (ownedAtUid) return context.userId;
  throw new Error("Open a school for management before continuing.");
}

/**
 * Phase 2 claims are sole privilege — but school owners often keep a stale JWT after
 * register (UI shows Institution from profile; enrol/create still saw role=student).
 * Heal claims once when the profile + school ownership prove they are the operator.
 */
export async function requireSchoolManagerContext(context: AuthedContext): Promise<string> {
  if (isSchoolManager(context.role)) {
    try {
      return await managedSchoolIdFor(context);
    } catch {
      if (!context.schoolId) throw new Error("You are not attached to a school.");
      return context.schoolId;
    }
  }

  const profile = await adminGetById<{
    role?: AppRole | string;
    school_id?: string | null;
    membership_status?: string | null;
  }>(COLLECTIONS.users, context.userId);

  if (!isSchoolManager(profile?.role as AppRole | undefined)) {
    throw new Error("You do not have permission to perform this action.");
  }

  const membership = profile?.membership_status ?? null;
  if (membership === "pending" || membership === "rejected") {
    throw new Error("You do not have permission to perform this action.");
  }

  let schoolId =
    (typeof profile?.school_id === "string" && profile.school_id) || context.schoolId || null;

  if (!schoolId) {
    const ownedAtUid = await adminGetById(COLLECTIONS.schools, context.userId);
    if (ownedAtUid) schoolId = context.userId;
  }
  if (!schoolId) throw new Error("You are not attached to a school.");

  const school = await adminGetById<{ owner_id?: string }>(COLLECTIONS.schools, schoolId);
  const owns = school?.owner_id === context.userId || schoolId === context.userId;
  const member = await adminGetById<{
    school_id?: string;
    status?: string;
    role?: string;
  }>(COLLECTIONS.schoolMembers, context.userId);
  const staffOk =
    member?.school_id === schoolId &&
    member.status === "approved" &&
    (member.role === "admin" || member.role === "institution");

  if (!owns && !staffOk) {
    throw new Error("You do not have permission to perform this action.");
  }

  try {
    await adminAuth().setCustomUserClaims(context.userId, {
      role: "admin",
      schoolId,
      approved: true,
    });
  } catch (error) {
    console.error("[auth] heal school-manager claims failed:", error);
  }

  // This request proceeds with healed privilege; client must refresh token next.
  context.role = "institution";
  context.schoolId = schoolId;
  context.approved = true;
  return schoolId;
}
