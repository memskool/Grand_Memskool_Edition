# Client fallback monitoring (Phase 10)

## What

Server-first live and academic mutations still keep a **deprecated** client dual-write when `isInfrastructureFailure(error)` is true (network / 5xx / `__dirname` ESM crash). Authz denials never fall back.

## Surfaces

| Analytics `role` | Code path |
|------------------|-----------|
| `live_start` | `useStartSession` |
| `live_end` | `useEndSession` |
| `live_cancel` | `useCancelSession` |
| `live_join` | `useJoinRoom` |
| `live_leave` | `useLeaveRoom` |
| `live_presence` | `useReportPresence` |
| `enrol_student` | `useEnrollStudent` |
| `assign_teacher` | `useAssignTeacher` |

Event name: `client_fallback` (`PRODUCT_EVENTS.clientFallback`).

## Deprecation gate

1. Enable Analytics (or confirm it is already on) for the production web app.
2. Watch `client_fallback` daily for **14 consecutive days**.
3. When count is **≈ 0** (ignore one-off deploy blips), remove client dual-path blocks and this doc’s “active” status.
4. Until then, treat any spike as a server/runtime incident, not a product feature.

## Shared predicate

`src/lib/infra-failure.ts` — single definition used by live + academic client modules.
