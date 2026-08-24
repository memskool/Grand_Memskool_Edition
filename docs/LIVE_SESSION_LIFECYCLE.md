# Live session lifecycle

Documented statuses: `scheduled` | `ready` | `live` | `ended` | `cancelled`.

## What the product does today

1. Teacher schedules a **lesson** (Phase 3: `draft` / `scheduled`).
2. Students see the class as idle / upcoming on `/virtual-classroom`.
3. Authorized teacher starts a session → Memskool status **`live`**, `is_active: true`.
4. Authorized students join; LiveKit tokens are issued only while the session is live.
5. Teacher ends → **`ended`**. Attendance is finalized (provisional). Linked lesson → `completed`.
6. Teacher may **cancel** instead → **`cancelled`**. No absence marks. Linked lesson returns to `scheduled`.

`scheduled` / `ready` on `classroom_sessions` are valid values and reserved. Pre-live discovery uses **lessons**, not a separate prepared room.

## Who may change state

| Transition | Who | How |
| --- | --- | --- |
| → live | Assigned teacher or school admin | `startLiveSession` |
| live → ended | Host, assigned teacher, or school admin | `endLiveSession` |
| live → cancelled | Same | `cancelLiveSession` |

Clients cannot create or patch session documents. Rules: `create, update, delete: if false`.

Students cannot force privileged states.
