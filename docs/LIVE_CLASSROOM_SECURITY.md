# Live classroom security

## Secrets

`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are server-only. The browser receives a short-lived JWT (~2h) and `LIVEKIT_URL`.

## Token grants (`issueClassroomToken`)

- Reuses `assertCanJoinSession` / Gold join / `adminIsSuspended`.
- `roomJoin`, `canSubscribe`, `canPublishData` for authorized users.
- `roomAdmin` only for the session host.
- Screen share sources only for host or school managers. Students: camera + microphone when publish is allowed.
- Same-school but **unenrolled** students cannot mint tokens.
- Session must be joinable (`live` + active).

## Session mutations

Start / end / cancel / join / leave / chat / presence / moderation / attendance correction prefer Admin SDK server handlers.

Client writes (infrastructure fallback only):

- Participants: self may update hand/mic/cam/leave fields — **not** `connected_at` / `is_host`.
- Session end still attempts privileged `finalizeSessionAttendance`.
- `live_session_events`: no client access.

## LIVE predicate

A room is LIVE only when the session is fresh **and** the host participant has `left_at == null`. Orphan `is_active` rows are healed. Host Leave and LiveKit host disconnect end the session.

## Attendance

- `connected_at` set by webhook or server `reportLivePresence` after LiveKit connect.
- End / cancel / host-disconnect webhook finalize session-keyed attendance docs (`live_{sessionId}_{studentId}`).
- Provisional rows only; corrections go through staff RPC.

## Webhook

LiveKit JWT verified. Presence side-effects run **before** idempotency record so failed presence can retry. Host disconnect ends session and finalizes attendance.

## Isolation (by design)

- Other school’s session (school claim mismatch).
- Class without active enrollment.
- Unassigned teacher hosting.
- Chat without join authz.
- Webhook without a valid LiveKit JWT.
