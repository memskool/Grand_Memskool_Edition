---
paths:
  - "src/features/live-classroom/**/*"
  - "src/lib/classroom-data.ts"
  - "src/lib/live-session-fresh.ts"
  - "src/lib/infra-failure.ts"
---

# Live classroom

- LIVE = `isFreshLiveSession` (active, status live, started_at ≤ 4h) **and** host participant `left_at` is null.
- Tokens: server-only (`token.server.ts`); screen share host/manager only; students may publish cam/mic when authorized.
- `connected_at` is server/webhook only — client presence must not forge it.
- Attendance finalize uses `liveAttendanceDocId` / `markFromParticipation` from `attendance-policy.ts`.
- Client dual-path only via `isInfrastructureFailure`; emit `client_fallback` analytics; never fall back on permission errors.
