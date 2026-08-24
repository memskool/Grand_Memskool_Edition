# Marking architecture

Authoritative marks are computed only in `gradeAttempt` / `markAssessmentAttempt` (Admin SDK). The client never writes scores.

## Automatic

`autoMarkQuestion` in `src/features/assessment/marking.ts`:

- MC / true-false: exact string match to the key.
- Multi-select: parsed JSON or comma list, sorted, compared.
- Short answer: `normalizeShort` against `correct_answer` and `accepted`.
- Long answer: never auto-marked.

Maximum points per question are taken from the question document, not the client.

## Manual

Teachers open Mark on a paper. They see that class’s submissions (not other schools). They can save progress or finalise. Marks are clamped to `0…question.points`.

## Unreleased scores

Scores land in `assessment_result_private` first. Students see scores on the attempt only after release (practice is always public).

## AI-assisted marking

**Deferred.** Crane5 is a tutor chat API. The engine does not send answers to the AI Gateway for marks. The UI states that the AI does not finalise scores.
