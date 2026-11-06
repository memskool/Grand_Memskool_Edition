# Phase 10 — Verification matrix

Manual + automated sign-off for production readiness. Mark each row after checking on the target environment (preview → prod).

| # | Scenario | Expected | Auto | Manual | Sign-off |
|---|----------|----------|------|--------|----------|
| 1 | Claims sole privilege: revoked member cannot call live/academic server fns | Denied with clear error; client dual-path does not run | infra-failure unit | ☐ | |
| 2 | Cross-tenant: user A cannot read/write school B session/enrolment | Rules + server deny | — | ☐ | |
| 3 | LIVE badge: host left (`left_at` set) | Not LIVE even if `is_active` | `isFreshLiveSession` + host predicate docs | ☐ | |
| 4 | LIVE badge: stale `started_at` (>4h) | Not LIVE | `isFreshLiveSession` unit | ☐ | |
| 5 | Start live → join → leave → end | Server path; attendance provisional rows | — | ☐ | |
| 6 | End live with large roster (>80) | All enrolled get attendance page writes | — | ☐ | |
| 7 | Live attendance id | `live_{sessionId}_{studentId}` stable across re-finalize | attendance-policy unit | ☐ | |
| 8 | Present vs absent by `live_attendance_min_seconds` | Duration gate | attendance-policy unit | ☐ | |
| 9 | Enrol student: not on school roll | Reject; no client bypass on authz | — | ☐ | |
| 10 | Enrol / assign teacher deterministic ids | No duplicate active rows | academic ids unit | ☐ | |
| 11 | Gold room: institution host only for privileged ops | Policy deny others | gold policy unit | ☐ | |
| 12 | Parent link id + access | Deterministic; nav PENDING_* gates | parent-link + nav units | ☐ | |
| 13 | Messaging rules deploy | Firestore rules live; Storage after console Get Started | — | ☐ | |
| 14 | Auth checkRevoked on sensitive paths | Stale claims fail closed | — | ☐ | |
| 15 | Client dual-path only on infra failure | `client_fallback` Analytics; authz never falls back | infra-failure unit | ☐ | |

## How to run automated checks

```bash
npm run test
npm run typecheck
npm run lint
```

## Residual risks

- Storage security rules not deployed until Firebase Console → Storage → Get Started, then redeploy.
- Client dual-path remains until `client_fallback` ≈ 0 for 14 days (see `CLIENT_FALLBACK_MONITORING.md`).
- Playwright / emulator e2e deferred; this matrix is the production gate.
