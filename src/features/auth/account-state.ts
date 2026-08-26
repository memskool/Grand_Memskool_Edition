import type { UserProfile } from "@/types/user";
import type { AppRole } from "@/types/roles";

export type AccountState = "incomplete" | "pending" | "suspended" | "active";

export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.full_name && profile.role);
}

export function accountState(input: {
  profile: UserProfile | null | undefined;
  role: AppRole | undefined;
  pendingApproval: boolean;
  suspended: boolean;
}): AccountState {
  if (!isProfileComplete(input.profile)) return "incomplete";
  const role =
    input.role ??
    (input.profile!.role === "admin" ? "institution" : input.profile!.role);
  if (!role) return "incomplete";
  if (input.suspended) return "suspended";
  if (input.pendingApproval) return "pending";
  return "active";
}
