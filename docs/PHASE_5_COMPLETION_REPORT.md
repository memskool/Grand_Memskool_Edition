# Phase 5 completion report

**Date:** 2026-08-22  
**Project:** `memskool-4e193`  
**Mandate:** Live learning, digital classrooms, collaboration. Phase 6 not started.

## 1. What existed before Phase 5

`/virtual-classroom` with `ClassroomRoom`, client Firestore start/join/leave/chat, and `issueClassroomToken` (LiveKit). Mic/camera, raise-hand, PiP, and school-scoped session queries existed. Lessons already reserved `classroom_session_id`. No Daily.co.

## 2. Audit findings

Documented in `docs/PHASE_5_AUDIT.md`. Functional when LiveKit env is set, but session create was a client write (`tenantWrite` includes teachers), participant create was any authenticated user, chat was not session-gated, enrollment ignored `ended`, no lesson/attendance/materials/screen-share/reconnect UX, slides panel was copy-only.

## 3. Provider and architecture

**LiveKit** kept. Memskool session ≠ provider room. Room name `memskool-{sessionId}` stored as `provider_room`. Privileged work is TanStack server functions + Admin SDK (Spark-safe; no new Cloud Functions required for classrooms).

## 4. What was built

- Session lifecycle `live` / `ended` / `cancelled` (plus reserved `scheduled` / `ready`).
- Secure start / end / cancel / join / leave / presence / chat / moderate / attendance correct.
- Tightened tokens (school, active enrollment, live-only, host-only screen share + `roomAdmin`).
- Lesson picker, materials from `lesson_materials`, Ask AI via Phase 4 button.
- Host screen share (desktop `getDisplayMedia`); disabled/explained where unsupported.
- Session chat through the server; rules require participant or staff.
- Connection banners (joining / reconnecting / lost).
- Notifications: class live, cancelled, missed follow-up (`kind: live_class`).
- Optional LiveKit webhook with JWT verify + idempotency.
- Teacher attendance review after end; optional assign catch-up (existing missed-work API).
- Firestore rules + indexes. Deterministic participant ids `{sessionId}_{uid}`.

## 5. Secure session access

Client never holds LiveKit secrets. Token mint checks identity, suspension, school, role, assignment or active enrollment, and live status. Students get participant grants only.

## 6. Attendance

Phase 3 `attendance` rows with `session_id` and `source: live_session`. Present only after verified LiveKit connect (and optional `schools.live_attendance_min_seconds`). Teacher corrections keep `previous_status`. Cancel does not mark absentees. Missed work is not auto-invented.

## 7. Operational real-time capabilities

Mic, camera, remote A/V, host screen share (desktop), participant list, raise-hand, session chat, reconnect copy, leave/end. LiveKit components kit is unused; custom UI remains.

## 8. Recordings

**Deferred.** See `docs/RECORDING_ARCHITECTURE.md`.

## 9. AI

Ask AI from the room/lesson uses the Phase 4 gateway. No classroom chat, audio, or video is sent to Crane5.

## 10. What was tested

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| ESLint on Phase 5 source (after Prettier) | Passed |
| `npm run build` | Passed |
| `firebase_validate_security_rules` (firestore) | No errors |

**Not run:** live two-party LiveKit call, real webhook from LiveKit Cloud, device-lab mobile/iOS, emulator rules unit tests, E2E, cross-account red-team in production. Do not treat those as passed.

## 11. Intentionally deferred

Recording/egress, live captions, Daily.co, parent live view, RoomService kick, scheduled pre-created rooms (lessons cover upcoming), sending A/V to AI, Cloud Functions deploy (still Spark).

## 12. Human configuration

1. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` on the server.
2. Optionally register webhook `https://<origin>/api/public/webhooks/livekit` in LiveKit Cloud with the same key/secret.
3. Deploy rules/indexes: `firebase deploy --only firestore:rules,firestore:indexes`.
4. Optional: `live_attendance_min_seconds` on the school document.
5. Blaze is still required for Cloud Functions / App Hosting; **not** required for classroom tokens (server functions).
6. Screen share needs a desktop browser with `getDisplayMedia`.
7. Crane5 env remains required for live tutor replies (Phase 4).
