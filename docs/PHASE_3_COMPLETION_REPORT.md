# Phase 3 completion report

**Date:** 2026-08-22  
**Project:** `memskool-4e193`  
**Mandate:** Core educational engine. Phase 4 not started.

## Audit findings

Phase 1–2 identity and school tenancy were in place. Academic collections existed (`classes`, `subjects`, `class_enrollments`, `timetable_slots`, `assignments`, `submissions`, `attendance`, `missed_work`) but were thin: one teacher per class, no years/terms, no curriculum, no lessons, no enrollment UI, no assignment submit, no attendance recorder, and over-broad client queries.

## Already present

School membership, class documents, weekly timetable grid, teacher assignment create/delete, student assignment **list**, missed-work **library files**, student attendance **read**.

## Built

- Academic years and labelled periods (Term / Semester / Quarter / Period).
- Subjects and curriculum (levels, topics).
- Classes with archive; enrollment history; teacher–class–subject assignments.
- Timetable create with overlap rejection.
- Lessons, materials (link + Storage), assignments, server-timestamped submissions.
- Attendance and staff-assigned missed work.
- School Admin tabs: Academic year, Curriculum, Classes & enrolment; existing Timetable tab uses the conflict-safe create.
- Teacher dashboard: lessons, attendance, missed-work assign.
- Student dashboard: submit work.
- Persistent Firestore cache (browser, not emulators). Submits still wait for the server function.

## Mock / broad queries replaced

- Student assignments query enrolled classes (not all due dates).
- Upcoming slots / teacher timetable / pending grading scoped to membership or assignment.
- Subjects scoped by `school_id`.
- Unused class delete now archives; unused unenroll now ends membership.

## Firestore collections added

`academic_years`, `academic_periods`, `curricula`, `curriculum_levels`, `curriculum_topics`, `curriculum_objectives`, `class_teacher_assignments`, `lessons`, `lesson_materials`.

Extended: `schools` (`current_academic_year_id`, `academic_period_label`), `classes` (`status`, year/period), enrollments (status + dates), assignments (`status`, `allow_resubmit`, `teacher_id`), submissions (server time, `late`, `storage_paths`), missed work (`status`, lesson/assignment refs).

## Security

- New match blocks for years, periods, curriculum, teacher assignments, lessons, materials.
- Enrollments/teacher assignments cannot be deleted; they can be ended.
- Completed lessons not teacher-editable.
- Submissions readable by owner or staff (not all school tenants).
- Storage submissions: `schools/{schoolId}/submissions/{studentId}/**`.
- Indexes listed in `docs/FIRESTORE_INDEXES.md`.

## Tests actually executed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npm run build` | Pass |
| `npm run lint` | **Fail** — repo-wide prettier CRLF / existing files, not a new emulator suite |
| Firebase emulator academic flows | **Not run** |
| Browser / device lab | **Not run** |
| Rules unit tests | **Not run** |

## Intentionally deferred

AI tutor, Digital Locker product, examinations, live classroom, parent academic expansion, national curriculum data, automatic scheduling, auto missed-work from absence, Cloud Functions deploy (Spark).

## Human actions still required

Same as Phase 1–2, plus deploy **rules and indexes** after review:

`firebase deploy --only firestore:rules,firestore:indexes,storage`

Enable Blaze for Functions. Fill `.env`. Confirm Storage bucket and Google OAuth domains.
