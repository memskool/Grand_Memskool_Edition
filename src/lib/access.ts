import { useSession, useRole, useProfile } from "@/hooks/useAuth";
import { useMySchool } from "@/lib/school-membership";
import { useSuspensionStatus } from "@/lib/discipline-data";
import type { AppRole } from "@/hooks/useAuth";
import { accountState, isProfileComplete, type AccountState } from "@/features/auth/account-state";

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
  const profile = useProfile(user);
  const school = useMySchool(user?.id);
  const suspension = useSuspensionStatus(user?.id);

  const r = (role.data ?? undefined) as AppRole | undefined;
  const needsApproval = r === "teacher";
  const membership = school.data?.membership;
  const approved = !needsApproval || membership === "owner" || membership === "approved";
  const profileReady = !user || profile.isFetched;
  const roleReady = !user || role.isFetched;
  const state: AccountState = accountState({
    profile: profile.data,
    role: r,
    pendingApproval: needsApproval && !approved,
    suspended: suspension.suspended,
  });

  return {
    user,
    role: r,
    profile: profile.data,
    profileExists: isProfileComplete(profile.data),
    accountState: loading || !profileReady || !roleReady ? ("loading" as const) : !user ? ("unauthenticated" as const) : state,
    loading: loading || !profileReady || !roleReady || (needsApproval && school.isLoading),
    schoolName: school.data?.name ?? null,
    schoolId: school.data?.id ?? null,
    hasSchool: !!school.data,
    pendingApproval: needsApproval && !approved,
    approved,
    suspended: suspension.suspended,
    emailVerified: user?.emailVerified ?? false,
  };
}
