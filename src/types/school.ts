import type { AppRole, MemberStatus } from "./roles";

export type School = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  country: string | null;
  contact_email: string | null;
  website: string | null;
  logo_url: string | null;
  admissions_open: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type SchoolMember = {
  id: string;
  school_id: string;
  user_id: string;
  role: AppRole;
  status: MemberStatus;
  student_code: string | null;
  created_at: string;
};

export type SchoolRosterRow = {
  id: string;
  school_id: string;
  full_name: string;
  role: AppRole;
  student_code: string | null;
  email: string | null;
  claimed_by: string | null;
  created_at: string;
};
