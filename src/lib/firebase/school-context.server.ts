import "@tanstack/react-start/server-only";
import { adminGetById } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { AuthedContext } from "@/lib/firebase/require-auth";

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
