import "@tanstack/react-start/server-only";
import { adminGetById } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { AuthedContext } from "@/lib/firebase/require-auth";

/** Resolve the school this operator is managing (claims first, then profile). */
export async function managedSchoolIdFor(context: AuthedContext): Promise<string> {
  if (context.schoolId) return context.schoolId;
  const profile = await adminGetById<{ school_id?: string | null }>(
    COLLECTIONS.users,
    context.userId,
  );
  if (profile?.school_id) return profile.school_id;
  throw new Error("Open a school for management before continuing.");
}
