# Timetable architecture

`timetable_slots` remain the weekly grid.

Added fields: `teacher_id`, `subject_id`, `academic_period_id`, `room`.

Creates go through `createTimetableSlotSafe`, which rejects overlapping start/end times on the **same class and day**. There is no automatic scheduler.

Students see slots for enrolled (non-ended) classes. Teachers see slots for owned or assigned classes. School admin still edits the grid on the Timetable tab.

Future live/hybrid class types can add fields later; `lessons.classroom_session_id` is the reserved link.
