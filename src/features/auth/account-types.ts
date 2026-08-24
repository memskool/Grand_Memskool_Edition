export const ACCOUNT_TYPES = [
  {
    value: "student",
    label: "Student",
    blurb: "Classes, locker, library, AI tutor, Dream School and the book store.",
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
    blurb: "Register your school, upload students and teachers, publish books.",
  },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];
