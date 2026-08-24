# Assessment data model

Unified on the existing assessment collections. Extra collections are only for bank, summaries, revision, integrity, and unreleased scores.

| Collection | Id | Client read | Client write | Purpose |
| --- | --- | --- | --- | --- |
| `assessments` | auto | Staff, or students if `published` and not `draft` | false | Paper + policy |
| `assessment_questions` | auto | Staff, or students if parent paper is published | false | Prompt, options, points — **no keys** |
| `assessment_answer_keys` | question id | false | false | `correct_answer`, `accepted` |
| `assessment_submissions` | auto | Owner student or staff | false | Attempt, answers, times, public scores |
| `assessment_result_private` | attempt id | Staff only | false | Scores before release |
| `question_bank` | auto | Staff, same school | false | Reusable copies |
| `performance_summaries` | student uid | Owner or staff | false | Incremental subject/topic rollup |
| `revision_plans` | auto | Owner or staff | false | Deterministic focus list |
| `assessment_integrity_events` | auto | Staff | false | Contextual session events |

## Assessment fields

`type`, `status` (`draft` \| `published` \| `closed` \| `archived`), `published`, `time_limit_minutes`, `max_attempts` (0 = unlimited), `available_from`, `available_until`, `results_released`, `reveal_answers` (stored; student key reveal is **not** implemented), `shuffle_questions`, `shuffle_options`, `total_points`, `notified_published_at`.

## Attempt fields (student-visible)

`answers`, `status`, `started_at`, `ends_at`, `submitted_at`, `question_order`, `option_order`, `attempt_number`, `results_released`. Scores and `question_marks` are copied onto this document only after release (or immediately for practice).

## Why private scores

Students can read their own attempt. Unreleased marks must not live on that document. Teachers read `assessment_result_private` to mark before release.
