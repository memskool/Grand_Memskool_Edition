# Attendance architecture

Statuses: `present` | `absent` | `late` | `excused`.

`recordLessonAttendance` writes one row per student per lesson (`lesson_id` + `student_id`), with `recorded_by` and `recorded_at`. Teachers may only record for lessons they own; school admins may record for the school.

Students still read their own `attendance` rows (existing `useMyAttendance`). Online auto-attendance is not implemented.
