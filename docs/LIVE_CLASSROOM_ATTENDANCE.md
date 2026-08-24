# Live classroom attendance

Reuses Phase 3 `attendance`. Does not invent a second register.

## Policy

Configurable on the school document: `live_attendance_min_seconds` (default **0**).

Present if:

- `connected_at` is set (LiveKit connect or verified webhook join), and
- Accumulated `duration_ms` ≥ `min_connected_seconds * 1000`.

Otherwise **absent**. Clicking Join alone is not enough.

Late is **not** auto-applied. Teachers can set `late` or `excused` in review. No invented late threshold.

## Flow

```
LiveKit connect → reportLivePresence
        ↓
Participation record (connected_at, duration_ms)
        ↓
endLiveSession
        ↓
Provisional attendance (source: live_session)
        ↓
Teacher review / correctLiveAttendance
        ↓
provisional: false + previous_status + correction_note
```

If the session has a `lesson_id`, the same attendance row is keyed with that lesson so Phase 3 `recordLessonAttendance` does not create a conflicting second mark for the same student/lesson when it updates the existing row.

Cancelled sessions do **not** write an absence roster.

## Connectivity

If the client drops without `leaveLiveSession`, duration may be short until a LiveKit `participant_left` webhook arrives (if configured). Teachers can correct marks.

## Missed work

Absentees get a notification linking to `/missed-work`. Requirements are **teacher-assigned** (`assignMissedWork`), including the optional “Assign catch-up” control after end. The system does not auto-create identical work for every absent student.
