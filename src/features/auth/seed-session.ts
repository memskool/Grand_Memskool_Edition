import type { QueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/types/roles";
import type { UserProfile } from "@/types/user";

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
}
