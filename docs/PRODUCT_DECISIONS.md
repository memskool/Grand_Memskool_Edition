# Product decisions (Phases 1–10)

Recorded so UI, rules, and docs stay aligned.

## Phase 10 readiness

| Decision | Choice | Notes |
| --- | --- | --- |
| Verification gate | Manual matrix + unit predicates | `docs/qa/phase10-matrix.md` |
| Dual-path client writes | Deprecated; infra-only | Remove after `client_fallback` ≈ 0 for 14 days |
| E2E / emulator suite | Deferred | Not blocking Phase 10 ship |

## Identity & access

| Decision | Choice | Notes |
| --- | --- | --- |
| Privilege authority | Firebase Auth **custom claims** only (`role`, `schoolId`, `approved`) | Profile `users/{uid}.role` must not elevate privilege |
| Email verification | **Banner only** — not an access gate | Confirmed email helps recovery; app features work without it |
| Pending teacher | School tools locked (`PENDING_SCHOOL_LOCK`); Gold + Home studio stay open | Sidebar and `canAccessRoute` use the same lock list |
| Institution claim | Claim `admin` maps to UI role `institution` | School managers: `admin` \| `institution` \| `superadmin` |

## Live classroom

| Decision | Choice | Notes |
| --- | --- | --- |
| Student A/V publish | **Allowed** (camera + mic) when enrolled and session is live | Token mint uses `assertCanJoinSession` |
| Screen share | **Host or school manager only** | Token `canPublishSources`; UI mirrors token |
| LIVE badge | Fresh session **and** host participant still present | Host Leave / LiveKit host disconnect ends the room |
| Attendance | Provisional rows only after real `connected_at` (server/webhook) | Client cannot forge presence |
| Client fallbacks | Infrastructure failures only | Authz denials never fall back to a weaker client write |

## Messaging & notifications

| Decision | Choice | Notes |
| --- | --- | --- |
| People picker | Same-school users only | Global `users` list is denied by rules |
| Client notification flush | Own undelivered rows only | Global drain requires `NOTIFICATIONS_DISPATCH_SECRET` |
| SMS alerts | **Not shipped** | Settings shows disabled SMS; email + in-app remain |

## Storage

| Decision | Choice | Notes |
| --- | --- | --- |
| Home published video | Metadata public; **bytes via signed URL** | `storage.rules` keeps `home/{uid}/…` private to creator |
| Gold materials | Tutor (or superadmin) Storage read; learners via enrolment + URL/signed path | Not world-readable |

## CSRF

Server functions authenticate with Firebase **Bearer** tokens (not cookies). CSRF origin middleware is installed but **filtered off** (`filter: () => false`) so legitimate cross-origin RPCs to `memskool.com` are not rejected. See `src/start.ts`.
