import { classEnrollmentId, classTeacherAssignmentId } from "./ids";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(classEnrollmentId("c1", "s1") === "c1_s1", "enrolment id");
assert(classTeacherAssignmentId("c1", "t1", "sub1") === "c1_t1_sub1", "teacher assignment id");

console.log("academic ids unit checks passed");
