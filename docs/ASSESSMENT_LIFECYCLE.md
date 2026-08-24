# Assessment lifecycle

## Paper states

`draft` → `published` → `closed` (optional `archived` reserved).

| Transition | Who | Server function |
| --- | --- | --- |
| Create / rebuild draft | Assigned teacher or school manager | `saveAssessment` |
| Publish | Same | `publishAssessment` (requires ≥1 question; notifies enrolled students once) |
| Close | Same | `closeAssessment` (`published` false) |
| Release results | Same | `releaseAssessmentResults` |

Published papers cannot be rebuilt. Close and create a new paper instead.

`scheduled` / `available` / `in_progress` / `marking` / `completed` from the product brief are **not** separate stored statuses. Availability is `available_from` / `available_until`. Student progress is the **attempt** status.

## Attempt states

`in_progress` → `awaiting_manual` or `graded`.

The reserved value `submitted` is accepted on the type but current submit writes `awaiting_manual` or `graded` only.

Idempotent resubmit returns the existing outcome and does not re-mark.
