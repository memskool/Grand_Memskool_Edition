import type { QueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/types/roles";
import type { UserProfile } from "@/types/user";
import { writeCachedProfile } from "@/features/auth/account-cache";

type SignupSeed = {
  role: AppRole;
  schoolId: string | null;
  membership: UserProfile["membership_status"];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** TanStack Start may wrap server-fn results; never assume the raw return has `.role`. */
export function unwrapSignupResult(raw: unknown, fallback: SignupSeed): SignupSeed {
  let current: unknown = raw;
  for (let i = 0; i < 5; i++) {
    const obj = asRecord(current);
    if (!obj) break;
    if (typeof obj["role"] === "string" && obj["role"]) {
      const membership = obj["membership"];
      return {
        role: obj["role"] as AppRole,
        schoolId: typeof obj["schoolId"] === "string" ? obj["schoolId"] : fallback.schoolId,
        membership:
          membership === "owner" ||
          membership === "pending" ||
          membership === "approved" ||
          membership === "rejected"
            ? membership
            : fallback.membership,
      };
    }
    current = obj["data"] ?? obj["result"] ?? obj["payload"] ?? obj["value"];
  }
  return fallback;
}

/** Keep the workspace gate from bouncing back to onboarding after a successful save. */
export function seedSessionAfterSignup(
  queryClient: QueryClient,
  input: {
    userId: string;
    email: string | null;
    fullName: string;
    role: AppRole;
    schoolId: string | null;
    membership: UserProfile["membership_status"];
    studentCode: string | null;
  },
) {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id: input.userId,
    full_name: input.fullName,
    email: input.email,
    avatar_url: null,
    phone: null,
    school_id: input.schoolId,
    student_code: input.studentCode,
    role: input.role,
    membership_status: input.membership,
    created_at: now,
    updated_at: now,
  };
  queryClient.setQueryData(["profile", input.userId], profile);
  queryClient.setQueryData(["role", input.userId], input.role);
  writeCachedProfile(profile);
}
