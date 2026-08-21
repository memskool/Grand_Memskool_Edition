import { useSession, useRole } from "@/hooks/useAuth";
import { useMySchool } from "@/lib/school-membership";
import type { AppRole } from "@/hooks/useAuth";

/** Routes a staff member can still use while their school approval is pending. */
export const PENDING_ALLOWED = ["/dashboard", "/messages", "/settings"];

/**
 * Access model for the whole app.
 *
 * - Role decides which workspace you get (see `src/lib/nav.ts`).
 * - Teachers must be approved by their school before any teaching tool unlocks.
 */
export function useAccess() {
  const { user, loading } = useSession();
  const role = useRole(user);
  const school = useMySchool(user?.id);

  const r = role.data as AppRole | undefined;
  const needsApproval = r === "teacher";
  const membership = school.data?.membership;
  const approved = !needsApproval || membership === "owner" || membership === "approved";


  return {
    user,
    role: r,
    loading: loading || role.isLoading || (needsApproval && school.isLoading),
    schoolName: school.data?.name ?? null,
    schoolId: school.data?.id ?? null,
    hasSchool: !!school.data,
    pendingApproval: needsApproval && !approved,
    approved,
  };
}
