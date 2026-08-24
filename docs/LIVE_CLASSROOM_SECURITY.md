# Live classroom security

## Secrets

`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are server-only. The browser receives a short-lived JWT (`ttl: 2h`) and `LIVEKIT_URL`.

## Token grants

- `roomJoin`, `canSubscribe`, `canPublishData` for authorized users.
- `roomAdmin` only for the session host.
- Screen share sources only for the host. Students: camera + microphone.
- Suspended users are rejected (`adminIsSuspended`).
- Enrollment must be **active** (`status !== ended`).
- Session must be **live**. Ended and cancelled sessions cannot be joined.
- School claim must match `session.school_id`.

## Session mutations

Start / end / cancel / join / leave / chat / presence / moderation / attendance correction use the Admin SDK after JWT + role checks.

Firestore client writes:

- Participants: owner may update only `hand_raised`, `mic_on`, `cam_on`.
- Sessions and messages: no client writes.
- `live_session_events`: no client access.

## Isolation tests (implemented as server checks; live dual-account tests not run)

Blocked by design:

- Other school’s session (school claim mismatch).
- Class without active enrollment.
- Student creating a session (role / assignment check).
- Forged session id (missing doc or failed authz).
- Chat without being allowed to join that session.
- Webhook without a valid LiveKit JWT.

## AI

Classroom chat and A/V are **not** sent to Crane5. Ask AI opens `/ai-tutor` with an authorized `lesson` search param. Phase 4 gateway re-fetches the lesson server-side.
