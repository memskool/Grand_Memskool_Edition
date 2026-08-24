# Phase 6 completion report

**Date:** 2026-08-22  
**Project:** `memskool-4e193`  
**Mandate:** Assessment, examination, revision, performance intelligence. Phase 7 not started.

## 1. What existed before Phase 6

`/assessments` builder, `/exam/$assessmentId`, collections `assessments` / `assessment_questions` / `assessment_answer_keys` / `assessment_submissions`, server MC auto-mark, Recharts from real submissions. Keys were split from prompts. Exam-mode hid the AI nav in the client.

## 2. Audit

See `docs/PHASE_6_AUDIT.md`. Device timers, no autosave, students could read drafts and patch attempt status, start was a client write, no release policy, parent charts used the parent uid, client `gradeAnswers` helper existed.

## 3. What was built

Unified Assessment Engine on the existing collections. Server functions for save/publish/close/start/clock/save answers/submit/mark/release/integrity/revision. Question bank, private scores until release, incremental performance summaries, deterministic revision plans, integrity events, enrollment-filtered lists, practice retakes, persisted shuffle, 2.5s autosave, teacher marking UI, student revision panel, parent report via linked-child server function.

## 4. Question types in production

`multiple_choice`, `multiple_select`, `true_false`, `short_answer` (normalized + variants; unmatched written answers wait for a teacher), `long_answer` (manual). Fill-in-blank, matching, multi-part, KaTeX, and image questions are not implemented.

## 5. Attempts and timers

`startAssessmentAttempt` is authoritative. `ends_at` is stored on the server. The client displays `remaining_ms` from `getAttemptClock` (20s refresh). Save after `ends_at` + 60s is rejected. Submit is idempotent.

## 6. Persistence and submit

Debounced autosave of the answer map. Recovery uses the in-progress attempt. Submit writes answers, auto-marks, and either publishes scores or holds them in `assessment_result_private`.

## 7. Marking

Automatic for objective kinds. Manual save/finalise for short and long answers. Frontend scores are never trusted.

## 8. AI-assisted marking

**Deferred.** Revision uses summaries + Phase 4 `REVISE` intent. Answers are not sent to Crane5 for marks.

## 9. Results

`results_released` (practice always true). Release copies private scores, notifies, and then updates summaries.

## 10. Performance intelligence

Incremental `performance_summaries`. Weakness threshold: ≥2 attempts and &lt;60%. Student charts hide unreleased papers. Teachers see class averages and a below-50% count (not a public rank).

## 11. Personalized revision

`generateRevisionPlan` plus Ask AI. Insufficient evidence is stated, not invented.

## 12. Integrity

Auth, enrollment, windows, attempt limits, server clock, persisted shuffle, visibility/save/submit events (capped). Exam-mode AI hide is a deterrent. Not cheat-proof.

## 13. What was tested

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| Prettier + ESLint on Phase 6 sources | Passed |
| `npx tsx src/features/assessment/marking.test.ts` | Passed |
| `npm run build` | Passed |
| `firebase_validate_security_rules` (firestore) | No errors |

**Not run:** live multi-student exam E2E, device-lab mobile/tablet, emulator rules unit tests, production red-team of forged IDs, App Check enforcement. Do not treat those as passed.

## 14. Intentionally deferred

Fill-in / matching / multi-part; question images; KaTeX; student answer-key reveal; AI as marker; scheduled Cloud Functions (Spark); invasive proctoring; Phase 7.

## 15. Human configuration

1. Deploy rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes`.
2. Existing Firebase Admin credentials for server functions remain required.
3. Crane5 env remains required for live tutor revision replies (Phase 4).
4. Blaze still required for Cloud Functions / App Hosting — **not** required for this engine (TanStack + Admin SDK).
5. Notifications reuse the existing in-app collection; outbound FCM/email still depends on prior billing/setup.
