/** Deterministic class enrolment id — one active row per class+student. */
export function classEnrollmentId(classId: string, studentId: string) {
  return `${classId}_${studentId}`;
}

/** Deterministic teacher assignment id — one active row per class+teacher+subject. */
export function classTeacherAssignmentId(classId: string, teacherId: string, subjectId: string) {
  return `${classId}_${teacherId}_${subjectId}`;
}
