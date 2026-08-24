# Live classroom data flow

## Start

1. Teacher calls `startLiveSession`.
2. Server checks school, teacher assignment (or school admin), and class status.
3. If a live session already exists for the class, it is reused.
4. Otherwise a session is created, `provider_room` is stored, optional lesson is set `in_progress`.
5. Up to 80 enrolled students get an in-app notification (`kind: live_class`).

## Join

1. Client calls `joinLiveSession` (participant doc).
2. `useLiveKit` requests `issueClassroomToken`.
3. Browser connects to LiveKit.
4. On connect, `reportLivePresence` sets `connected_at` (this is what attendance uses).

Clicking Join without a successful LiveKit connection does **not** mark present.

## During class

| Data | Where |
| --- | --- |
| Media / speaking / reconnect | LiveKit (ephemeral) |
| Participant list, hand, mute flags | Firestore listeners |
| Chat | Firestore `classroom_messages` |
| Lesson files | Existing `lesson_materials` |
| AI | Phase 4 `/ai-tutor` gateway only |

High-frequency media events are **not** written to Firestore every second.

## Leave / end

- Leave: `leaveLiveSession` accumulates `duration_ms`.
- End: close open participants, write provisional attendance, mark session `ended`, complete the linked lesson, notify absentees (Missed Work link). No automatic missed-work items.
- Cancel: session `cancelled`, no absence roster, lesson returned to `scheduled` if it was linked.

## Webhook (optional)

LiveKit may POST join/leave. Signature verified. Duplicate event ids ignored. Used as a backup for presence, not as the only source of truth.
