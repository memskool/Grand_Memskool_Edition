import type { AppRole, MemberStatus } from "./roles";

export type UserProfile = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  school_id: string | null;
  student_code: string | null;
  role: AppRole;
  membership_status: MemberStatus | "owner" | null;
  created_at: string;
  updated_at: string;
};

export type SignupRequest = {
  full_name: string;
  role: Exclude<AppRole, "superadmin" | "admin">;
  school_code: string | null;
  student_code: string | null;
  school_name: string | null;
};
