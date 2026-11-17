# Live classroom — critical audit (2026-11-17)

Scope: every surface of the live classroom for every role (host teacher, co-teacher, school
admin / institution, student, parent, superadmin), plus the realtime layer the rest of the app
shares (live chat, participants, notifications, direct messages).

Method: static audit of server handlers, rules, tokens, webhook and client hooks; runtime
checks of the production server path; unit tests for new pure logic. **No browser/LiveKit
end-to-end run was possible from the audit machine** — the manual matrix in §4 is the gate
before this is declared fully verified.

## 1. What was broken (and is now fixed)

| #   | Symptom                                                                                  | Root cause                                                                                                                                                                                                                                          | Fix                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Chat, participants, LIVE badges, notifications and DMs only updated after a page refresh | Every Firestore listener was unguarded. On the first error (stale token; or a student's chat listener opened a moment before the server wrote their `classroom_participants` row that rules check) the SDK terminates the listener **permanently**. | `src/lib/firebase/live-subscribe.ts`: listeners re-arm with backoff (1s→30s) and refresh claims on a permission error. All seven subscription sites use it.                                                                                                                                |
| 2   | New chat messages lagged by seconds                                                      | Snapshot → invalidate → refetch everything → one `users/{id}` read **per message** on every new message                                                                                                                                             | Snapshots are applied straight to the cache; sender/participant profiles come from a 5-minute cache (`profileLite`). Sender sees their own message instantly (optimistic insert).                                                                                                          |
| 3   | Students sat in a dead room after the teacher ended the class                            | The room never watched the session document, and the LiveKit room was never torn down server-side                                                                                                                                                   | `useWatchLiveSession` follows the session doc: on end/cancel everyone gets a toast and is returned to the rooms list. `endLiveSession` / `cancelLiveSession` / host-disconnect webhook now delete the LiveKit room (`deleteLiveKitRoom`, Twirp REST), so media drops for everyone at once. |
| 4   | Co-teachers saw **End session / Mute all / Nudge** and got "not allowed"                 | UI gated moderation on `isTeacher`; the server (`assertCanManageSession`) allows only the session host or a school manager                                                                                                                          | `ClassroomRoom` takes `isManager`; moderation chrome = host **or** manager, matching the server. Screen-share button follows the token grant, not the role.                                                                                                                                |
| 5   | Chat send / moderation fell back to a direct client write on _any_ server error          | Violated the "never fall back on authz denials" rule; produced misleading permission toasts                                                                                                                                                         | Fallbacks are now infrastructure-only (`isInfrastructureFailure`) and report through `fallbackWriteError`.                                                                                                                                                                                 |
| 6   | Notifications appeared only on the next bell open                                        | Listener → invalidate → refetch; no in-app announcement                                                                                                                                                                                             | Snapshot-direct; new unread notifications toast with an **Open** action while the app is open.                                                                                                                                                                                             |

## 2. Verified correct (no change needed)

- **Authority**: tokens are minted server-side (`token.server.ts`) with the same join checks as
  `joinLiveSession` (enrolment / assignment / suspension / Gold). Screen share is
  `canPublishSources`-gated to host and managers. Students can publish cam/mic.
- **Presence truth**: `connected_at` is written only by `reportLivePresence` (server, after the
  LiveKit connection) or the LiveKit webhook. The client cannot forge attendance.
- **Attendance**: finalised on end/cancel/host-disconnect; deterministic ids
  (`live_{session}_{student}`); confirmed corrections are never clobbered; absentees get a
  Missed-Work notification in pages of 80.
- **One live room per class**: `reconcileActiveSessionsForClass` closes orphans, keeps the
  oldest fresh session with a present host, and the post-create race check keeps one winner.
- **Indexes**: every realtime query (`classroom_messages`, `classroom_participants`,
  `classroom_sessions`, `notifications`, `messages`) has its composite index.
- **Rules**: student reads of participants/chat require a live-participant row or an active
  session; `is_host`, `connected_at`, `last_connected_at` are immutable from the client;
  moderation fields are teacher/admin only; `live_session_events` is server-only.

## 3. Known limitations (decisions, not bugs)

- **Host disconnect ends the room.** A teacher who refreshes the page or loses network for
  longer than LiveKit's reconnect window triggers `participant_left`; the webhook ends the
  session and finalises attendance. Re-entering starts a _new_ session. Documented product
  truth (Phase 5/6); a grace period would require a scheduler the Spark plan does not offer.
- The webhook only fires if the LiveKit project's webhook URL points at
  `/api/public/webhooks/livekit`. Without it, attendance still works via `reportLivePresence`,
  but host-disconnect clean-up relies on the client `liveRoomState` heal.
- Chat and DM windows are the latest 80 rows; no history paging.
- No cloud recording, captions, or parent live view.

## 4. Manual verification matrix (run on production after deploy)

Use two browsers (or one normal + one private window). "✓ live" = visible **without** a refresh.

| #   | Role(s)                         | Steps                                          | Expect                                                                                                                                                                                                              |
| --- | ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Teacher (host)                  | Rooms → Start session                          | Room opens immediately; "You are hosting"; LIVE badge on the class card; students get "Your class is live" toast + bell dot ✓ live                                                                                  |
| 2   | Student                         | Open Virtual Classroom while teacher starts    | Card flips to **Live / Join live lesson** ✓ live; Join → camera/mic prompt; host tile shows teacher video when the teacher turns the camera on                                                                      |
| 3   | Student                         | Type in Live chat                              | Own message appears instantly; teacher sees it ✓ live (<1s); sender name correct                                                                                                                                    |
| 4   | Teacher                         | Reply in chat                                  | Student sees it ✓ live                                                                                                                                                                                              |
| 5   | Student                         | Raise hand                                     | Hand icon on the teacher's learner tile ✓ live; Lower hand clears it                                                                                                                                                |
| 6   | Teacher                         | Mute all / Mute one / Camera off one / Nudge   | Student's mic/camera forced off ✓ live; nudge toast on the student                                                                                                                                                  |
| 7   | Teacher                         | Share screen                                   | Student stage shows the shared screen; "Shared screen" label                                                                                                                                                        |
| 8   | Co-teacher (assigned, not host) | Join the same room                             | Can publish and chat; **no** End / Mute-all / Nudge controls                                                                                                                                                        |
| 9   | School admin                    | Open the room                                  | End / Mute-all available; End works                                                                                                                                                                                 |
| 10  | Teacher                         | End session                                    | Attendance review lists every enrolled student (present/absent + minutes); students get "The live class has ended." toast and are returned to the rooms list ✓ live; absent students get a Missed-Work notification |
| 11  | Teacher                         | Correct a mark; Assign catch-up                | Mark changes to "confirmed"; missed-work item appears for the student ✓ live                                                                                                                                        |
| 12  | Student (not enrolled)          | Open the room URL directly                     | "You are not allowed to join this class."                                                                                                                                                                           |
| 13  | Pending teacher                 | Virtual classroom                              | Locked by `PENDING_SCHOOL_LOCK`                                                                                                                                                                                     |
| 14  | Any                             | Receive a DM while on Messages                 | Message appears ✓ live; own message instantly                                                                                                                                                                       |
| 15  | Any                             | Receive any notification while on another page | Toast with Open; bell dot ✓ live                                                                                                                                                                                    |
| 16  | Host                            | Refresh the page mid-class                     | (Limitation) session ends; "Last session ended"; Start creates a new one                                                                                                                                            |

Tick rows in this file after running them on live.
