# Phase 6 audit — Assessment & performance intelligence

**Date:** 2026-08-22  
**Method:** Phase 1–5 docs plus `assessment.functions.ts`, `assessment-data.ts`, `exam.$assessmentId.tsx`, `AssessmentBuilder.tsx`, `PerformanceAnalytics.tsx`, `exam-mode.ts`, and Firestore rules.

---

## 1. What already exists

| Item | Location |
| --- | --- |
| `/assessments` | Teacher builder, student list, parent stub, Recharts analytics |
| `/exam/$assessmentId` | Full-screen timed paper |
| Server submit | `submitAssessment` — MC auto-score, short-answer pending |
| Answer keys | Separate `assessment_answer_keys`; students do not read via client query |
| Owner key fetch | `ownerAssessmentQuestions` |
| Exam AI lock | `exam-mode.ts` — client `sessionStorage` hides `/ai-tutor` |
| Charts | `usePerformanceTrend` / `useTeacherAssessmentStats` from submissions |
| Question kinds | `multiple_choice`, `short_answer` |

Collections: `assessments`, `assessment_questions`, `assessment_answer_keys`, `assessment_submissions`.

---

## 2. What genuinely works (when data exists)

- Teachers can create MC + short-answer papers (client writes).
- Students can start an attempt and submit; MC is scored on the server.
- Keys are not on question documents.
- Charts plot real submission percents (not hardcoded demo scores).

---

## 3. Mock / incomplete

- Timer uses **device `Date.now()`** against `started_at`.
- Answers live only in React state — **no autosave**.
- Results always shown immediately (no release policy).
- No question bank, no topic metadata, no attempt limits, no shuffle persistence.
- Exam lock is UI-only (not a security control).
- Parent view charts the **parent’s** user id, not the child.
- `gradeAnswers()` client helper can score if keys are present (not used on the exam page).

---

## 4. Insecure / weak

- Students `tenantRead` **all** school assessments, including **drafts**.
- `useAvailableAssessments` lists every published paper in the school, not just enrolled classes.
- `useStartAttempt` is a client `createDoc` — no enrollment, publish, or window check.
- Students may **update** submission `answers` and `status` in rules.
- `ownerAssessmentQuestions` treats any teacher/admin as privileged **without school match**.
- Submit does not verify time expiry, attempt ownership beyond student_id, or unpublished papers.
- No protection against resubmit changing a graded paper (update overwrites).

---

## 5. Incomplete vs Phase 6

Lifecycle beyond `published` boolean; question bank; extra types; server clock; autosave; manual marking UI; result release; performance summaries (not live recompute); revision plans; integrity events; notifications on publish/release.

---

## 6. Preserve

Existing collections and split keys. Exam route chrome. Assessment builder layout. Recharts panels (feed them released results). Phase 4 AI gateway for revision — do not bypass. Exam-mode nav hide as a **deterrent only**.

---

## 7. Refactor

Move create / publish / start / save / submit / mark / release to Admin SDK. Tighten rules (`create/update` false on keys and attempts). Filter student lists by enrollment. Fix owner key school check.

---

## 8. Assessment capabilities already present

Create, publish toggle, delete, sit exam, MC auto-grade, short-answer flag, simple trend charts.

---

## 9. Marking already present

Server MC equality. Short answer never auto-scored. No teacher marking screen. No AI marking.

---

## 10. Intentionally defer

Fill-in-the-blank, matching, multi-part, KaTeX, question images (unless trivial), AI as final marker (Crane5 is a tutor chat API, not a marking service), “cheat-proof” lockdown browsers, scheduled Cloud Functions for analytics (Spark).

## Plan

Unify on existing collections. Add `question_bank`, `performance_summaries`, `revision_plans`, `assessment_integrity_events` only. Types: MC, multi-select, true/false, short, long. Server clock + autosave + release + manual mark + incremental summaries + deterministic revision + AI Tutor link.
