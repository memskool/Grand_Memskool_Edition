# Security

## Rules

- `firestore.rules` default-deny. Tenant reads/writes require matching `request.auth.token.schoolId`.
- `school_directory/{CODE}` is **public read**, write denied. Only non-sensitive lookup fields belong there.
- `assessment_answer_keys` is **Admin-only** (client read/write false). Students never read keys.
- Assessment create/update/delete, attempt writes, bank writes, summaries, revision plans, integrity events, and private scores are Admin SDK only.
- Students may read published (non-draft) assessments in their school; drafts are staff-only.
- Messaging: membership via `member_ids`; not world-readable.
- `orders` and `reward_events` are not client-created.
- `notifications` and `notification_deliveries` are not client-created. Scores on submissions cannot be patched by students.
- `audit_logs`, `payment_events`, and `live_session_events` are Admin-only.
- `classroom_sessions` and `classroom_messages` are not client-created. Participant self-updates are limited to `hand_raised`, `mic_on`, `cam_on`.
- `storage.rules` scopes locker paths under `users/{uid}/…` and school files under `schools/{schoolId}/…`.

These rules are a **reviewed prototype**. Deploy only after a pass against the auditor checklist.

## Auth

- Roles live in **custom claims**, assigned by Admin SDK after signup.
- `superadmin` cannot be chosen at signup.
- Session tokens are attached as `Authorization: Bearer` for server functions (`src/lib/firebase/auth-attacher.ts`).

## App Check

Gated on `VITE_FIREBASE_APPCHECK_SITE_KEY`. Unset = not initialized. Do not enforce App Check in the console until the site key and debug tokens are ready.

## Secrets

Service accounts, Flutterwave, LiveKit, Resend, and Africa’s Talking stay on the server. Open Firestore rules must not remain in production.

## Billing

Spark blocks Functions deploy. Until Blaze is on, treat trigger-based FCM/email fan-out as **not live**; `flushNotifications` still drains deliveries if something wrote them via Admin SDK.
