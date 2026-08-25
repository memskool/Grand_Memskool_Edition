import { signupIntentError, signupPayload, type SignupIntent } from "./signup-intent";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const parent: SignupIntent = {
  role: "parent",
  fullName: "Ada Lovelace",
  schoolCode: "",
  studentCode: "",
  schoolName: "",
};

assert(signupIntentError(parent) === null, "parent intent is complete");
assert(signupIntentError({ ...parent, fullName: "  " }) === "Enter your name.", "name required");
assert(
  signupIntentError({ ...parent, role: "student", schoolCode: "MS-1" }) ===
    "Enter the student ID your school gave you.",
  "student id required",
);
assert(
  signupIntentError({
    role: "institution",
    fullName: "Head Teacher",
    schoolCode: "KMHS-2026",
    studentCode: "",
    schoolName: "Kampala Modern",
  }) === null,
  "institution intent is complete",
);

const payload = signupPayload({
  role: "teacher",
  fullName: "  Jane  ",
  schoolCode: "ms-4f91a2",
  studentCode: "",
  schoolName: "",
});
assert(payload.full_name === "Jane", "name trimmed");
assert(payload.school_code === "ms-4f91a2", "teacher school code kept");
assert(payload.student_code === null, "teacher has no student code");

console.log("signup intent unit checks passed");
