# Live classroom data model

Extended existing collections. One new Admin-only collection.

## `classroom_sessions` (auto id)

Memskool session record. Not a LiveKit room id.

| Field | Meaning |
| --- | --- |
| `school_id`, `class_id`, `host_id` | Tenancy and host |
| `lesson_id` | Optional Phase 3 lesson |
| `title` | Display title |
| `status` | `scheduled` \| `ready` \| `live` \| `ended` \| `cancelled` |
| `is_active` | `true` only while `live` (keeps existing queries) |
| `provider` | `"livekit"` |
| `provider_room` | `memskool-{sessionId}` |
| `started_at`, `ended_at`, `cancelled_at` | Times |
| `attendance_finalized_at` | Set on end |
| `notified_live_at` | Duplicate-prevention for “class is live” |

Created sessions today go straight to `live`. `scheduled` / `ready` are reserved; upcoming work is shown from Phase 3 **lessons**.

## `classroom_participants` (id = `{sessionId}_{userId}`)

Deterministic id so rules can `exists()` the participant and so join/rejoin is idempotent.

| Field | Meaning |
| --- | --- |
| `joined_at`, `last_joined_at`, `left_at` | Click/join lifecycle |
| `connected_at`, `last_connected_at` | Verified LiveKit presence |
| `duration_ms`, `rejoin_count` | Accumulated connection time |
| `hand_raised`, `mic_on`, `cam_on`, `camera_allowed`, `warned_at` | UI / moderation |
| `is_host` | Host flag |

## `classroom_messages` (auto id)

Session-scoped chat: `session_id`, `sender_id`, `school_id`, `body`, `created_at`. Written only by Admin SDK.

## `attendance` (existing)

On session end, one row per enrolled student with `session_id`, optional `lesson_id`, `source: "live_session"`, `provisional`, `duration_ms`, `connected_at`. Teacher corrections set `previous_status`, `correction_note`, `provisional: false`.

## `live_session_events` (provider event id)

Webhook idempotency only. Client read/write denied.

## `notifications`

`kind: "live_class"` for live / cancelled / missed follow-up. Client cannot create notifications.

## Not created

Separate `recordings` collection — recording is deferred.
