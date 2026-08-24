# Phase 5 audit — Live classrooms

**Date:** 2026-08-22  
**Method:** Phase 1–4 docs plus `virtual-classroom.tsx`, `ClassroomRoom.tsx`, `useLiveKit.ts`, `livekit.functions.ts`, `classroom-data.ts`, Firestore rules, and `.env.example`.

---

## 1. What already exists

| Item | Location |
| --- | --- |
| Route `/virtual-classroom` | Role nav for student/teacher/institution/admin |
| LiveKit token mint | `issueClassroomToken` (server, secrets stay server-side) |
| Room UI | `ClassroomRoom` — stage, tiles, chat, mute, camera, PiP, raise hand |
| Client hook | `useLiveKit` — connect, mic/cam, remotes |
| Firestore | `classroom_sessions`, `classroom_participants`, `classroom_messages` |
| Packages | `livekit-client`, `livekit-server-sdk`, `@livekit/components-react` (UI does **not** use the components kit) |

**Provider:** **LiveKit**, not Daily.co. Phase 1 documented LiveKit. No Daily.co code or env vars.

---

## 2. What is functional (when LiveKit env is set)

- Teachers can start a session (client Firestore write).
- Students see a Live badge and join.
- Server JWT: host or enrolled student; suspended users blocked.
- Mic/camera, chat, participant list, leave/end.

Needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

---

## 3. Mock / incomplete

- “Slides” panel is copy only (“appear in the Locker”).
- No `lesson_id` on sessions; not tied to timetable or Phase 3 lessons.
- `is_active` boolean only — no scheduled / cancelled / ended lifecycle.
- No screen share.
- No attendance write to Phase 3 `attendance`.
- No missed-work follow-up on absence.
- No LiveKit reconnect UX.
- `@livekit/components-react` unused.
- Recording: none.

---

## 4. Insecure / weak

- Students could **create** sessions if they pass `tenantWrite` (teacher **or** school admin). Rules: `tenantWrite` = teacher or admin same school.
- Participant **create** is `allow create: if isAuthenticated()` with no school/session check.
- Chat create does not require being in the session.
- Token enrollment query does not ignore `status == ended`.
- Join/leave/end are client writes (spoofable leave times).
- No webhook verification.

---

## 5. Incomplete vs Phase 5 mission

Lifecycle, lesson link, materials, attendance reconciliation, notifications, screen share, connection recovery, AI entry from the room.

---

## 6. Preserve

LiveKit, server tokens, `ClassroomRoom` design, existing collections (extend, don’t fork), chat UX, exam/suspension locks.

---

## 7. Replace

Client `createDoc` for session start/end/join/leave/chat → Admin SDK server functions. Tighten rules (`create: false` for sessions; chat via server or participant check).

---

## 8. LiveKit capabilities (actual)

Supported in the SDK we already ship: camera, mic, subscribe, **screen share** (`setScreenShareEnabled`), reconnect events, data publish, host `roomAdmin`.  
**Egress/recording** needs LiveKit Cloud egress + storage — **not** wired. Defer recordings.  
Webhooks: LiveKit can POST signed events; optional to add.

---

## 9. Backend required

Token mint (exists), session start/end, join/leave, chat send, attendance finalize, notifications, optional webhook.

---

## 10. Deferred

Daily.co, Cloud recording/egress, live captions, LiveKit Cloud dashboard, vector/AI on recordings, full participant kick via provider API, parent live view.

## Plan

Keep LiveKit. Add `status`, `lesson_id`, `provider_room`. Server-authorize all privileged transitions. Screen share for hosts. Attendance on verified LiveKit connect + session end. Materials + Ask AI from lesson. Notify class when live. Recording documented as deferred.
