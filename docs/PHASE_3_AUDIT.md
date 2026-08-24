# Phase 3 audit — Memskool

**Date:** 2026-08-22  
**Method:** Phase 1–2 docs were read, then `src/`, `firestore.rules`, `firestore.indexes.json`, and Storage rules were inspected. The codebase is the source of truth.

---

## 1. Existing academic functionality

Already present and Firestore-backed (Phase 1 conversion):

| Area                       | Implementation                                                                  | Gaps                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Schools                    | `schools`, `school_members`, `school_roster`, institution dashboard             | No academic calendar settings                                                                   |
| Classes                    | `classes` with `name`, `room`, `subject_id`, `teacher_id`, `school_id`          | One teacher and one subject per class; no year/period; hard delete in unused `school-manage.ts` |
| Enrollments                | `class_enrollments` (`class_id`, `student_id`, `school_id`)                     | No status/history; `allow update: false`; unused enroll UI (`school-manage.ts` has no callers)  |
| Subjects                   | `subjects` (`name`, `code`)                                                     | School-admin create UI missing; `useSubjects` is **unscoped** (all subjects)                    |
| Timetable                  | `timetable_slots` weekly grid; school-admin create/delete; student/teacher view | No conflict check; no teacher/subject on slot; no period                                        |
| Assignments                | Teacher create/delete; student list on dashboard                                | No submit UI; no lifecycle; student query is school-wide `orderBy(due_at)`                      |
| Submissions                | Collection exists; grading queue for teachers                                   | Client timestamps; students cannot submit from the product UI                                   |
| Attendance                 | `useMyAttendance` for students/parents                                          | No teacher recorder; no lesson link                                                             |
| Missed work                | `missed_work` as catch-up **library files** (`reviewed`, `released_to_locker`)  | Not tied to absence → required work                                                             |
| Lessons                    | Storage path `schools/{id}/lessons/**` exists                                   | **No `lessons` collection**                                                                     |
| Curriculum / years / terms | —                                                                               | **Missing**                                                                                     |
| Teacher–class–subject      | `classes.teacher_id` only                                                       | Cannot model multiple teachers per class                                                        |

`school-admin` Classes & timetable is the main operator UI. Institution dashboard is membership/roster, not academics.

---

## 2. Existing mock data

No JSON academic fixtures. Problems are **over-broad queries** and **incomplete models**, not fake names:

- `useMyAssignments` loads assignments by `due_at` without class filter (rules then expose the whole school).
- `useUpcomingSlots` / `useTeacherTimetable` ignore the signed-in user’s classes.
- `useSubjects` is not filtered by `school_id`.
- `usePendingGrading` loads ungraded submissions school-wide (OK for admin; too wide for a teacher).

---

## 3. Existing Firebase data models

Documented in `docs/DATABASE_SCHEMA.md` and `COLLECTIONS` in `src/lib/firebase/repo.ts`. Academic docs already carry `school_id` for tenancy. Missing collections: `academic_years`, `academic_periods`, `curricula` / topics / objectives, `class_teacher_assignments`, `lessons`, `lesson_materials`.

---

## 4. Existing educational screens

- Student dashboard: enrolled classes, pending assignments (view only), locker count.
- Teacher dashboard: teaching classes (`teacher_id`), grading queue, assignment panel, behaviour.
- Parent: child attendance/performance if linked.
- School admin: register school, class + slot forms, staff list, admissions, meetings.
- `/timetable`: weekly grid + personal reminders.
- `/missed-work`: reviewed/unreviewed catch-up files + overdue assignments.
- `/assessments`: exams (Phase 4+; leave alone).

---

## 5. Broken / incomplete flows

- Students cannot submit assignment work in the UI.
- Teachers cannot record attendance.
- No enrollment UI in school-admin (hooks exist unused).
- Google/institution schools have no academic year to hang classes on.
- Changing nothing today “corrupts history” because there is no history.
- Class delete in `school-manage.ts` would drop the class document (not wired to UI).
- Storage `schools/{schoolId}/submissions/**` is readable by **any** same-school signed-in user.

---

## 6. Firestore limitations / query needs

Required access patterns (to index):

- Years/periods by `school_id` + `starts_on`
- Subjects by `school_id` + `name`
- Classes by `school_id` + `status` + `name`
- Enrollments by `student_id` + `status`; by `class_id` + `status`
- Teacher assignments by `teacher_id` + `status`; by `class_id` + `status`
- Lessons by `class_id` + `starts_at`; by `teacher_id` + `starts_at`
- Assignments by `class_id` + `due_at` (exists); add `school_id` + `status`
- Submissions by `assignment_id` + `submitted_at`; by `student_id`
- Attendance by `lesson_id`; by `student_id` + `recorded_at`
- Missed work by `student_id` + `status`

Do not load a whole school into the client and filter.

---

## 7. Security gaps

- Students can read all school assignments/timetable/classes (tenant read). Tighten reads where practical: enrollments already allow owner OR tenant. Assignments/lessons should remain school-readable for enrolled students **or** we query by class id after membership check. Rules cannot cheaply express “enrolled in class” without a membership doc. **Decision:** keep tenant read for catalogue (classes, subjects, timetable, published assignments, published lessons). **Private:** submissions (owner or staff), attendance (owner or staff), missed work (owner or staff). Staff writes stay `tenantWrite`.
- Tighten Storage submissions to `schools/{schoolId}/submissions/{studentId}/**`.
- Enrollment updates must be allowed for status `ended` (admin), not hard-delete history.
- Classes: **archive**, do not delete when they have enrollments.
- Teacher must not edit another teacher’s lesson unless school admin.

---

## 8. Responsive issues

School-admin class form is a 5-column grid (already wraps). Timetable table on mobile is a known squeeze (`WeeklyTimetable`). Phase 3 forms must stack on small screens; enrollment lists as cards, not wide tables.

---

## 9. Exact implementation plan

1. **Extend, do not duplicate** `classes`, `subjects`, `class_enrollments`, `timetable_slots`, `assignments`, `submissions`, `attendance`, `missed_work`.
2. Add collections listed in §3. Internal name for terms: `academic_periods` with school-facing `period_label` (Term / Semester / Quarter / Period) on the school.
3. `current_academic_year_id` on `schools` is a pointer only; historical docs keep their own year/period ids.
4. Domain code in `src/features/academic/` (types, zod, server functions, hooks) consistent with `src/features/auth`.
5. Privileged integrity via server functions: enroll/end, teacher assign, timetable conflict, assignment submit (server time), attendance, missed-work assign.
6. Connect school-admin (Academic / Curriculum / Enrolment tabs), teacher dashboard (lessons, attendance, submissions, missed work), student dashboard (submit, lessons), timetable (filter + conflicts), missed-work (new statuses, keep old reviewed files).
7. Indexes + rules + storage path tightening.
8. Firestore persistent cache as an **offline foundation**; submissions still go through the server so success means the server accepted them.
9. Do not build AI, full locker, exams, or live classroom.

**Out of scope:** national curriculum data dump, automatic scheduler, parent academic expansion, Phase 4+.
