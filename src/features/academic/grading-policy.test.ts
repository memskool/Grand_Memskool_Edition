import { canSubmit, formatMark, needsMarking, validateGrade } from "./grading-policy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(validateGrade(18, 20) === null, "in-range mark is valid");
assert(validateGrade(0, 20) === null, "zero is a valid mark");
assert(validateGrade(20, 20) === null, "full marks are valid");
assert(validateGrade(21, 20) !== null, "above max is rejected");
assert(validateGrade(-1, 20) !== null, "negative is rejected");
assert(validateGrade(Number.NaN, 20) !== null, "NaN is rejected");
assert(validateGrade(80, 0) === null, "unknown points fall back to a 100 cap");

assert(needsMarking("submitted", null), "submitted + no grade needs marking");
assert(needsMarking("late", undefined), "late + no grade needs marking");
assert(!needsMarking("graded", 12), "graded does not");
assert(!needsMarking("returned", null), "returned waits on the student, not the teacher");

assert(canSubmit(null, false).ok, "first submission always allowed");
assert(canSubmit({ status: "returned" }, false).ok, "returned work may be resubmitted");
assert(!canSubmit({ status: "graded" }, true).ok, "marked work cannot be overwritten");
assert(!canSubmit({ status: "submitted" }, false).ok, "resubmit blocked when not allowed");
assert(canSubmit({ status: "submitted" }, true).ok, "resubmit allowed before marking");

assert(formatMark(18, 20) === "18 / 20 (90%)", "mark formatting");
assert(formatMark(7, 0) === "7", "no points → bare mark");

console.log("grading-policy unit checks passed");
