# Live classroom data flow

Aligned with Phases 5–6 server-required start/join/token and Phase 8 Gold parity.

## Start

1. Teacher/manager calls `startLiveSession` (server).
2. Server checks suspension, school, assignment (or school manager), class status.
3. `reconcileActiveSessionsForClass` ends orphans; reuses only if host still present.
4. Otherwise creates session, seeds host participant, notifies enrolled students (`kind: live_class`).
5. Race: post-create reconcile keeps a single winner.

## Join

1. Client calls `joinLiveSession` (Admin authz + participant upsert).
2. `useLiveKit` → `issueClassroomToken` (same join authz + publish policy).
3. Browser connects to LiveKit.
4. On connect, `reportLivePresence` / webhook sets `connected_at` (attendance proof).

Clicking Join without a successful LiveKit connection does **not** mark present.

## During class

| Data | Where |
| --- | --- |
| Media / speaking / reconnect | LiveKit (ephemeral) |
| Participant list, hand, mute flags | Firestore listeners |
| Chat | Firestore `classroom_messages` (school or Gold `gold_{tutorId}` tenant) |
| Lesson files | `lesson_materials` / Gold resources |
| AI | `/ai-tutor` gateway only — not classroom A/V |

## Leave / end

- Student leave: marks `left_at`.
- Host leave: ends session (same as End) so LIVE cannot stick.
- End / cancel: close participants, finalize attendance, update lesson; absentees notified in pages.
- LiveKit host disconnect webhook: end + finalize.

## Webhook

Signature verified. Presence applied before idempotency key. Host disconnect ends the room.
