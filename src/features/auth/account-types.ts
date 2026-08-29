export const ACCOUNT_TYPES = [
  {
    value: "student",
    label: "Student",
    blurb:
      "Create your account, confirm your email, then explore Dream School, the library, AI tutor and more from your dashboard.",
  },
  {
    value: "parent",
    label: "Parent",
    blurb: "Follow attendance, performance and school communication for your child.",
  },
  {
    value: "teacher",
    label: "Teacher",
    blurb: "Request to join your school, then teach, grade and run live classes.",
  },
  {
    value: "institution",
    label: "School / Institution",
    blurb: "Create one online school, then run admissions, classes and staff from your workspace.",
  },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];
