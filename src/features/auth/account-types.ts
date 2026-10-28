export const ACCOUNT_TYPES = [
  {
    value: "student",
    label: "Student",
    blurb: "Classes, locker, assessments and the AI tutor. You can join a school later.",
  },
  {
    value: "parent",
    label: "Parent",
    blurb: "Follow a linked child’s timetable, attendance and released results.",
  },
  {
    value: "teacher",
    label: "Teacher",
    blurb: "Sign in first, then apply to a school or teach independently on Gold.",
  },
  {
    value: "institution",
    label: "School",
    blurb: "Register one school, then approve staff, classes and families.",
  },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

/** Where a finished account should land. */
export function workspaceHome(role: string | null | undefined): "/school-admin" | "/dashboard" {
  return role === "institution" || role === "admin" ? "/school-admin" : "/dashboard";
}
