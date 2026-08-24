# Missed work architecture

Staff assign required catch-up after an absence (`assignMissedWork`). The product does **not** invent work automatically.

Statuses: `pending` | `in_progress` | `completed`.

Older catch-up **files** (`reviewed`, `released_to_locker`) from the library flow still exist on the same collection. New items also set `lesson_id` / `assignment_id` / `material_id` when provided.

Students update progress through `updateMissedWorkStatus`. Future recordings, AI summaries, and locker copies can hang off the same document.
