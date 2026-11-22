# Phase 10 — Verification matrix

Manual + automated sign-off for production readiness. Mark each row after checking on the target environment (preview → prod).

| # | Scenario | Expected | Auto | Manual | Sign-off |
|---|----------|----------|------|--------|----------|
| 1 | Claims sole privilege: revoked member cannot call live/academic server fns | Denied with clear error; client dual-path does not run | infra-failure unit | ☐ | |
| 2 | Cross-tenant: user A cannot read/write school B session/enrolment | Rules + server deny | `test:rules` (tenant isolation block) | ☐ | |
| 3 | LIVE badge: host left (`left_at` set) | LIVE during the 3-min reconnect grace, then closed by `expireHostGrace` | `hostPresence` unit (live-session-fresh) | ☐ | |
| 4 | LIVE badge: stale `started_at` (>4h) | Not LIVE | `isFreshLiveSession` unit | ☐ | |
| 5 | Start live → join → leave → end | Server path; attendance provisional rows | — | ☐ | |
| 6 | End live with large roster (>80) | All enrolled get attendance page writes | — | ☐ | |
| 7 | Live attendance id | `live_{sessionId}_{studentId}` stable across re-finalize | attendance-policy unit | ☐ | |
| 8 | Present vs absent by `live_attendance_min_seconds` | Duration gate | attendance-policy unit | ☐ | |
| 9 | Enrol student: not on school roll | Reject; no client bypass on authz | — | ☐ | |
| 10 | Enrol / assign teacher deterministic ids | No duplicate active rows | academic ids unit | ☐ | |
| 11 | Gold room: institution host only for privileged ops | Policy deny others | gold policy unit | ☐ | |
| 12 | Parent link id + access | Deterministic; nav PENDING_* gates | parent-link + nav units | ☐ | |
| 13 | Messaging rules deploy | Firestore rules live; Storage needs Blaze (see residual risks) | `test:rules` (messaging block) | ☐ | |
| 14 | Auth checkRevoked on sensitive paths | Stale claims fail closed | — | ☐ | |
| 15 | Client dual-path only on infra failure | `client_fallback` Analytics; authz never falls back | infra-failure unit | ☐ | |
| 16 | Tenant list queries pin `school_id` (rules are not filters) | Lists load; unpinned shapes are rejected | `test:rules` (rules-are-not-filters block) | ☐ | |
| 17 | Assignments / submissions / assessments are server-only | Client creates and student self-grading denied | `test:rules` | ☐ | |
| 18 | Notifications & push tokens are per-user | Cannot read others' alerts or register tokens for them | `test:rules` | ☐ | |
| 19 | Uploads with Storage off | Honest "uploads are not switched on" message; written work still submits | app-error unit | ☐ | |

## How to run automated checks

```bash
npm run test
npm run typecheck
npm run lint
npm run test:rules   # Firestore rules in the emulator; needs Java 21+ (JAVA_HOME)
```

## Residual risks

- **Storage requires the Blaze plan.** Since 3 Feb 2026, Spark projects have no Cloud Storage access (calls return 402/403). Until the project is on Blaze (it keeps a free tier: 5 GB stored, 1 GB/day download for default buckets), assignment attachments, lesson materials, locker/library files and Home videos cannot upload. After upgrading: Console → Storage → Get started, then `firebase deploy --only storage`.
- Client dual-path remains until `client_fallback` ≈ 0 for 14 days (see `CLIENT_FALLBACK_MONITORING.md`).
- Playwright / emulator e2e deferred; this matrix is the production gate.
