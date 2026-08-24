# Question bank

School-scoped reusable copies. A bank row is created when a teacher ticks **Save a copy to this school’s question bank** on save.

Fields: `school_id`, `created_by`, `subject_id`, `topic_id`, `kind`, `prompt`, `options`, `correct_answer`, `accepted`, `points`, `status`, `created_at`.

Staff can read the bank (rules: `tenantWrite`). Students cannot. The builder lists the latest 40 items and can append a copy into the draft. Papers still store their own question documents so later bank edits do not rewrite live papers.

Cross-school leak is blocked by `school_id` on write (server uses the teacher’s school) and staff-only reads.
