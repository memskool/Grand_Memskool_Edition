# Academic architecture

Phase 3 extends the existing Firestore collections. It does not replace `classes`, `subjects`, `class_enrollments`, `timetable_slots`, `assignments`, `submissions`, `attendance`, or `missed_work`.

## Calendar

- `academic_years` — named year with `starts_on` / `ends_on`.
- `academic_periods` — generic period (`label`: Term / Semester / Quarter / Period).
- `schools.current_academic_year_id` is a **pointer only**. Historical class, enrollment, and lesson documents keep their own year/period ids.
- `schools.academic_period_label` is the school-facing word for a period.

## Classes and people

- `classes.status`: `active` | `archived`. UI archives; it does not delete academic history.
- `class_enrollments.status`: `active` | `ended` plus `started_at` / `ended_at`. Rows are not deleted.
- `class_teacher_assignments` — teacher + class + subject. A class may have several teachers.

## Learning

- `lessons` with statuses `draft | scheduled | in_progress | completed | cancelled`. Completed lessons are not editable by the teacher (rules).
- `lesson_materials` — file / link / note; Storage under `schools/{schoolId}/lessons/{lessonId}/`.
- Assignments: `draft | published | closed`. Submissions go through `submitAssignmentWork` so `submitted_at` is server-authored.
- Attendance: `present | absent | late | excused`, keyed to a lesson.
- Missed work: `pending | in_progress | completed`, assigned by staff (not auto-invented).

Domain code lives in `src/features/academic/` (schemas, server functions, hooks). Existing `src/lib/*-data.ts` files were tightened to school/class filters rather than rewritten.
