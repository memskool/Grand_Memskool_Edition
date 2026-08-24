# Security hardening (Phase 7)

Roles and school tenancy come from Firebase Auth **custom claims**, not client-supplied `role` / `schoolId` fields.

## Fixed in Phase 7

- `orders` client create denied; paid status is Admin SDK + Flutterwave verify only.
- Messaging requires `member_ids` (max 20) and membership for reads/writes.
- `parent_students` create/delete is school-admin + `sameSchool` only.
- `reward_events` client writes denied; daily check-in is an idempotent server function (`{uid}_{date}`).
- Marketplace items scoped to `school_id`; checkout rejects cross-school item IDs.
- `school_applications` admin update/read requires `sameSchool`.
- Locker item updates cannot change `owner_id` or `school_id`.
- Assignment submissions cannot be client-set to an arbitrary status (only `submitted` / `late`).
- School membership create must point at an existing school document.
- Storage: MIME allowlists, size caps, delete split from create (so deletes still work).
- Notification flush is throttled per user (15s).
- Authenticated routes send `noindex`; `robots.txt` disallows app paths.
- Security headers via `public/_headers` (nosniff, referrer, frame, permissions). CSP **not** set — it would risk Firebase Auth, LiveKit, and payment redirects.

## Still human / platform

App Check is optional until a site key is set and enforced in the console. Spark still blocks Cloud Functions. Emulator rules unit tests were not run in this phase.
