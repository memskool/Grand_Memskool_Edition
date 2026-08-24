# Webhook processing (LiveKit)

Route: `POST /api/public/webhooks/livekit`

## Verification

`WebhookReceiver` from `livekit-server-sdk` validates the `Authorization` (or `Authorize`) header with `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`. Unauthenticated bodies are rejected (401). Missing credentials → 503.

Payload size cap: 200 KB.

## Idempotency

Event id is stored at `live_session_events/{id}`. Duplicates return `{ received: true, duplicate: true }` without re-applying leave/join.

## Handled events

| Event | Action |
| --- | --- |
| `participant_joined` | `markParticipantConnected` |
| `participant_left` / `participant_connection_aborted` | `markParticipantLeft` |

Room name must be `memskool-{sessionId}`. Identity is the Firebase uid.

Other LiveKit events (including egress) are accepted after verification but ignored.

## Trust

Webhooks are a backup for presence. Attendance still prefers `reportLivePresence` from an authenticated user plus teacher review.
