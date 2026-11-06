/** Product roles. `institution` is the school-operator workspace (stored as admin claims). */
export type AppRole = "student" | "teacher" | "parent" | "admin" | "institution" | "superadmin";

export type MemberStatus = "pending" | "approved" | "rejected";

export type AuthUser = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
};

/** Custom claims written only by Admin SDK / Cloud Functions. */
export type MemskoolClaims = {
  role: AppRole;
  schoolId: string | null;
  approved: boolean;
};

/** School-operator + platform roles (claims may store institution as `admin`). */
export const PRIVILEGED_ROLES: readonly AppRole[] = ["admin", "institution", "superadmin"];

export function isSchoolManager(role: AppRole | undefined): boolean {
  return role != null && (PRIVILEGED_ROLES as readonly AppRole[]).includes(role);
}

export function claimsRoleToAppRole(role: string | undefined): AppRole {
  if (role === "student" || role === "teacher" || role === "parent") return role;
  if (role === "admin") return "institution";
  if (role === "institution") return "institution";
  if (role === "superadmin") return "superadmin";
  return "student";
}
