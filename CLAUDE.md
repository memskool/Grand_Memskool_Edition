# Memskool — Claude Code project guide

Uganda school platform: multi-tenant schools, live classes, assessments, Gold tutoring, Home video, messaging.

Production: `memskool.com` · Firebase project `memskool-4e193` · Firestore Enterprise `default` @ `africa-south1` · synced via Lovable + GitHub `main`.

## Stack

- **App:** TanStack Start + React 19 + Vite + TanStack Query/Router
- **Auth/data:** Firebase Auth custom claims + Firestore + Admin SDK on server
- **Live:** LiveKit (server-minted tokens)
- **Not live product paths:** Supabase client leftovers, Data Connect stubs — do not revive

## Architecture (non-negotiable)

1. **Claims sole privilege** — JWT `role`, `schoolId`, `approved`. Never elevate from `users/{uid}.role` alone.
2. **Claim `admin` ↔ UI `institution`** — school managers: `admin` | `institution` | `superadmin`.
3. **Server-first mutations** — `createServerFn` + `requireFirebaseAuth` + Admin SDK. Client dual-write only when `isInfrastructureFailure` (`src/lib/infra-failure.ts`); never on authz denials.
4. **School heal** — stale Institution JWT after register: `requireSchoolManagerContext` (`src/lib/firebase/school-context.server.ts`) heals claims when profile + ownership prove operator.
5. **Tenant isolation** — every academic/live/messaging write carries correct `school_id`; rules use token `schoolId` / `managesSchool`.
6. **No Lovable history rewrite** — no force-push, rebase, or amend of pushed commits on the connected branch.

## Layout

| Path | Role |
| --- | --- |
| `src/features/*` | Domain: auth, academic, live-classroom, assessment, gold, home, ai-tutor |
| `src/lib/*` | Shared server/client libs (firebase, errors, nav, discovery-data) |
| `src/routes/*` | TanStack file routes |
| `firestore.rules` / `storage.rules` | Security rules |
| `docs/` | Product + QA truth (`PRODUCT_DECISIONS.md`, `qa/phase10-matrix.md`) |
| `AGENTS.md` | Lovable + lint-before-commit gate |

## Commands

```bash
npm run dev
npm run typecheck
npm run test
npm run lint
npx eslint --fix <touched-files>   # REQUIRED before every commit
npm run build
```

Node `>=22.12`. Never commit `.env` or `*firebase-adminsdk*.json`.

## Product truths (Phases 1–10 done)

- LIVE badge = `isFreshLiveSession` (≤4h) **and** host still in room (`left_at` null).
- Attendance: provisional; id `live_{sessionId}_{studentId}`; no client-forged `connected_at`.
- Enrol / assign teacher: server path; deterministic ids in `src/features/academic/ids.ts`.
- Pending teachers: `PENDING_SCHOOL_LOCK` — school tools closed; Gold + Home studio open.
- Dual-path client writes: **deprecated**; monitor Analytics `client_fallback`; do not add new ones.
- Storage rules: enable Storage in Firebase Console before deploy (still a launch blocker if unset).
- SMS / cloud recording / Playwright e2e / AI as exam marker: deferred.

## When fixing bugs

1. Prefer server handler + claims heal over weakening Firestore rules.
2. Map user-facing errors through `authErrorMessage` / `classifyFirebase` — keep messages honest.
3. After claim writes: `refreshAuthClaims()` on the client.
4. Touching rules → validate + deploy (`firestore:rules`); Storage only after console Get Started.
5. Before commit: `eslint --fix` on staged TS/JS; then typecheck/tests for the area you changed.

## Do not

- Trust profile `role` for privilege without ownership/staff proof + claim heal
- Add a third client write path for academic/live
- Put secrets in `VITE_*`
- Force-push `main` or rewrite published history
- Claim the product is fully production-ready without ticking `docs/qa/phase10-matrix.md` on live

## Deeper docs (read when needed — do not invent against these)

- `docs/PRODUCT_DECISIONS.md`
- `docs/SECURITY.md` / `docs/AUTHORIZATION.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/qa/CLIENT_FALLBACK_MONITORING.md`
- `docs/PHASE_10_COMPLETION_REPORT.md`
