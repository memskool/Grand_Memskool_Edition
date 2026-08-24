# Lesson lifecycle

Statuses: `draft` → `scheduled` → `in_progress` → `completed`, or `cancelled`.

Teachers create and attach materials (link or Storage file). Firestore rules block a teacher from updating a **completed** lesson; school admins still can.

`lesson_materials` hold metadata (`kind`, `url` or `storage_path`, optional `locker_ref` for a later locker link). Files are not public; Storage requires same-school sign-in.

`classroom_session_id` and `recording_ref` are reserved for later live classroom / recording phases.
