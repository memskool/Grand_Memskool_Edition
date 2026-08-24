# Assignment architecture

Assignment `status`: `draft` | `published` | `closed`.

Student work is **not_started** when no submission exists, then `submitted` or `late`, then `returned` / `graded` after staff review.

`submitAssignmentWork`:

- Confirms enrollment.
- Uses server time (`submitted_at` + `submitted_at_server`).
- Sets `late` from `due_at`.
- Allows resubmit only when `allow_resubmit` is true (default true for teacher-created work).
- Does not treat a local Firestore cache write as success — the client waits for the server function.

Submission files: `schools/{schoolId}/submissions/{studentId}/…`. Only that student or school staff can read them.
