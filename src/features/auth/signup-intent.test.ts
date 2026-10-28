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
  signupIntentError({ ...parent, role: "student", schoolCode: "", studentCode: "" }) === null,
  "student can register without school or student id",
);
assert(
  signupIntentError({ ...parent, role: "teacher", schoolCode: "" }) === null,
  "teacher can register without a school id",
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
assert(payload.school_code === null, "teacher signup does not send a school code");
assert(payload.student_code === null, "teacher has no student code");

const studentPayload = signupPayload({
  role: "student",
  fullName: "Ada",
  schoolCode: "MS-IGNORE",
  studentCode: "STU-IGNORE",
  schoolName: "",
});
assert(studentPayload.school_code === null, "student signup ignores school code");
assert(studentPayload.student_code === null, "student signup ignores student code");

console.log("signup intent unit checks passed");
