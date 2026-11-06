# Security

Truth as of Phases 1–9. Prefer this file over older audit reports when they disagree.

## Authority

- **Custom claims** (`role`, `schoolId`, `approved`) are the sole privilege source for rules and server handlers.
- Admin SDK mutations run only on the server (`createServerFn` + `requireFirebaseAuth`, or privileged webhooks).
- Browser dual-write paths exist only for **infrastructure** failures (e.g. Admin ESM/`__dirname` outages), never to bypass authz.

## Firestore rules (high level)

- Default deny. Tenant access uses `sameSchool` / `tenantRead` against **token** `schoolId`.
- `school_directory/{CODE}` is public read, write denied (non-sensitive lookup only).
- Live: `classroom_sessions` client create is host+staff fallback only; updates host/admin allowlisted; `is_host` is not self-escalatable; `connected_at` is **not** client-writable.
- Gold session metadata is host/tutor readable (not world-readable).
- Messaging: conversation membership required; member add needs self-accept or same-school peer; message updates allowlist `body`/`edited_at`.
- Notifications: create for self, or school admin to a same-school recipient; deliveries Admin-only.
- Assessment answer keys, payment events, live session events, audit logs: Admin-only.

## Storage rules

- Locker / school paths scoped to owner or `schoolId` claim.
- `home/{userId}/…` — creator (or superadmin) only; published playback uses **Admin signed URLs**.
- `gold/{tutorId}/…` — tutor (or superadmin) only; not world-readable.
- Enable Firebase Storage in the console before deploying `storage.rules` (project must have Storage set up).

## Auth

- Roles assigned via Admin SDK after signup / approve / enrol / assign.
- `superadmin` cannot be chosen at signup.
- Sensitive RPCs verify ID tokens with **`checkRevoked: true`** (`src/lib/firebase/admin.server.ts`).
- Session tokens ride as `Authorization: Bearer` for server functions.

## App Check

Gated on `VITE_FIREBASE_APPCHECK_SITE_KEY`. Unset = not initialized. Do not enforce in the console until keys are ready.

## Secrets

Service accounts, Flutterwave, LiveKit, Resend, Africa’s Talking, notification dispatch secret stay on the server.

## Related

- [AUTHORIZATION.md](./AUTHORIZATION.md)
- [LIVE_CLASSROOM_SECURITY.md](./LIVE_CLASSROOM_SECURITY.md)
- [PRODUCT_DECISIONS.md](./PRODUCT_DECISIONS.md)
