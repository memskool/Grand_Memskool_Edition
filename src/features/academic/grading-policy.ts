/**
 * Pure assignment-marking rules shared by the server handlers and the UI.
 * No Firebase imports, so this stays unit-testable.
 */

export type SubmissionStatusLike = "submitted" | "late" | "returned" | "graded" | string;

/** A mark must be a finite number between 0 and the assignment's points (inclusive). */
export function validateGrade(grade: number, points: number): string | null {
  if (!Number.isFinite(grade)) return "Enter a mark as a number.";
  if (grade < 0) return "A mark cannot be negative.";
  const max = Number.isFinite(points) && points > 0 ? points : 100;
  if (grade > max) return `The mark cannot be more than ${max}.`;
  return null;
}

/** Work that has been handed in and still needs a teacher decision. */
export function needsMarking(status: SubmissionStatusLike, grade: number | null | undefined) {
  return (status === "submitted" || status === "late") && (grade === null || grade === undefined);
}

/**
 * May the student hand this assignment in (again)?
 * - First submission: always (subject to open/closed checks elsewhere).
 * - Returned for changes: always — the teacher asked for a redo.
 * - Already marked: never — a resubmission would silently wipe the mark.
 * - Otherwise: only when the assignment allows resubmission.
 */
export function canSubmit(
  existing: { status?: SubmissionStatusLike | null } | null | undefined,
  allowResubmit: boolean | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!existing) return { ok: true };
  if (existing.status === "returned") return { ok: true };
  if (existing.status === "graded") {
    return { ok: false, reason: "This work has already been marked." };
  }
  if (allowResubmit === false) {
    return { ok: false, reason: "Resubmission is not allowed for this assignment." };
  }
  return { ok: true };
}

/** "18 / 20 (90%)" — percent omitted when points are unknown. */
export function formatMark(grade: number, points: number | null | undefined): string {
  if (!points || points <= 0) return `${grade}`;
  const pct = Math.round((grade / points) * 100);
  return `${grade} / ${points} (${pct}%)`;
}
