# Integrations

This file describes integrations that exist in the Memskool codebase today. A row is **complete in code** when the client, server, env, and failure path are implemented. It is **not live in production** until a human sets credentials, webhooks, and domains.

Do not treat leftover folders (`src/integrations/supabase`, Data Connect) as product backends. The app backend is Firebase.

---

## 1. Firebase Authentication

- **Purpose:** Sign up, sign in, Google sign-in, session, custom claims (`role`, `schoolId`, `approved`).
- **Where:** `src/features/auth`, `src/lib/firebase`, `completeSignup` server function.
- **Client/server:** Browser uses the Firebase JS SDK. Server uses Admin SDK (`FIREBASE_SERVICE_ACCOUNT_JSON`) to mint claims after signup.
- **Env:** `VITE_FIREBASE_*` (public). Admin JSON on the server.
- **Secrets:** Service account JSON — never `VITE_`.
- **Webhooks:** None.
- **Authn:** Email/password + Google. Password reset and verification email go through Resend, not the Firebase `firebaseapp.com` mailer.
- **Failure:** User-facing copy in `auth-errors.ts`. Raw Firebase codes are not shown.
- **Test:** Create account, verify email link, sign in, sign out, reset password, Google popup, session after refresh.
- **Production:** Add the real domain to Firebase Auth authorized domains. Put the service account JSON **contents** on the host, not a file path.

## 2. Cloud Firestore

- **Purpose:** Schools, membership, classes, lessons, locker metadata, assessments, applications, notifications, classroom sessions.
- **Where:** `src/lib/firebase/repo.ts`, `admin-repo.ts`, `firestore.rules`, `firestore.indexes.json`.
- **Client/server:** User-scoped reads/writes under rules. Privileged writes (grading, payments, tokens, family links, notifications) use Admin SDK.
- **Env:** Project id via `VITE_FIREBASE_PROJECT_ID`. Region `africa-south1`.
- **Secrets:** Admin SDK.
- **Failure:** `permission-denied` maps to a permission message. Offline maps to a connection message.
- **Test:** Rules syntax (`firebase deploy --only firestore:rules --dry-run` or emulator). Composite indexes in `firestore.indexes.json`.
- **Production:** Deploy rules and indexes. Enable PITR/backups in Console (not in-repo).

## 3. Firebase Storage

- **Purpose:** Locker files, school assets, assignment uploads.
- **Where:** `storage.rules`, locker/library/assignment upload UI.
- **Client/server:** Client uploads to scoped paths; rules enforce ownership.
- **Secrets:** None in the browser beyond the public Firebase config.
- **Failure:** Size/type validation in UI; rules reject cross-user paths.
- **Production:** Deploy `storage.rules`.

## 4. Firebase Analytics / App Check / Cloud Messaging

- **Analytics:** Initialized when measurement id is set. Events such as `workspace_open` (no lesson/assessment content).
- **App Check:** Optional. On only if `VITE_FIREBASE_APPCHECK_SITE_KEY` is set. Do not enforce in Console until debug tokens exist.
- **FCM:** Web push registration is a no-op without `VITE_FIREBASE_VAPID_KEY`. In-app notifications still persist in Firestore.

## 5. Memskool AI Tutor (Crane5)

- **Purpose:** In-app tutoring with school-scoped context.
- **Where:** `src/features/ai-tutor/gateway.functions.ts`, `crane5.ts`, `/ai-tutor`.
- **Client/server:** Browser calls `sendTutorTurn`. Server authenticates, rate-limits, assembles authorized context, then POSTs to Crane5. Credentials never leave the server.
- **Env:** `CRANE5_API_URL`, `CRANE5_API_KEY`, optional `CRANE5_MODEL`, `CRANE5_VISION`.
- **Secrets:** API key — server only.
- **Webhooks:** None.
- **Authn:** Firebase bearer on the Memskool function; Crane5 key on the outbound call.
- **Failure:** If URL/key missing, the UI shows “Tutor not connected yet” (`getPlatformCapabilities.tutor === false`). The server refuses the turn before creating a conversation. No dummy answers.
- **Streaming:** Not implemented. Crane5 replies are complete JSON.
- **Test:** With keys: ask a question from an enrolled lesson. Without keys: send is disabled.
- **Production:** Add Crane5 URL and key. Confirm the adapter matches Crane5’s actual chat-completions contract.

## 6. Dashboard learning-memory insights (Lovable AI gateway)

- **Purpose:** Optional student/teacher insight cards. **Not** the tutor.
- **Where:** `src/lib/learning-memory.functions.ts`, `AiInsightPanel`.
- **Env:** `LOVABLE_API_KEY`.
- **Failure:** Refresh is disabled until the key is present. Stored insights still render if they exist.

## 7. Live classroom (LiveKit)

- **Purpose:** Live video rooms for authorized class sessions.
- **Where:** `session.server.ts`, `src/lib/livekit.functions.ts`, `ClassroomRoom.tsx`, `/api/public/webhooks/livekit`.
- **Client/server:** Memskool owns `classroom_sessions`. LiveKit owns media. `issueClassroomToken` mints a short-lived JWT.
- **Env:** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- **Secrets:** API secret — server only.
- **Webhooks:** `POST /api/public/webhooks/livekit` (signature via LiveKit `WebhookReceiver`).
- **Authn:** Token grant is limited to the session room; join is checked against class membership / host role.
- **Failure:** Missing credentials → start/join disabled and a service notice. Camera/mic failures stay in the room UI.
- **Not used:** Daily.co.
- **Test:** Teacher starts session → student in the class joins → outsider is refused → teacher ends.
- **Production:** Same key/secret in LiveKit Cloud webhook settings. Point webhook at the production origin.

## 8. Payments (Flutterwave)

- **Purpose:** Marketplace books/resources and tutoring bookings.
- **Where:** `payments.functions.ts`, `payments.server.ts`, `payments-apply.server.ts`, `/api/public/webhooks/flutterwave`.
- **Client/server:** Client starts checkout via server function. Flutterwave hosts payment. Entitlement updates only after server verification or signed webhook.
- **Env:** `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`.
- **Secrets:** Never `VITE_`.
- **Webhooks:** `POST /api/public/webhooks/flutterwave`.
- **Authn:** Secret key on API calls; webhook hash on inbound events. Duplicate events are applied idempotently.
- **Failure:** Empty secret → checkout paused in UI; `startCheckout` throws before creating an order.
- **Test:** Not runnable until sandbox keys exist. Then: initiate → pay → webhook → order `paid`; cancel/fail must not grant access.
- **Production:** Live keys, webhook URL, and hash. Confirm currency (listings use the item currency, often UGX).

## 9. Transactional email (Resend)

- **Purpose:** Email verification continue links, password reset, school notices.
- **Where:** `src/lib/mail.server.ts`, auth mail functions, `notifications.server.ts`.
- **Env:** `RESEND_API_KEY`, `RESEND_FROM` (example: `Memskool <notifications@memskool.com>`).
- **Secrets:** API key — server only.
- **Authn:** Resend API.
- **Failure:** Feature-level error; the rest of the app still loads.
- **Production:** Verify `memskool.com` (or the chosen domain) in Resend. Add `APP_ORIGIN` and the same origin to Firebase authorized domains.

## 10. SMS (Africa’s Talking)

- **Purpose:** Optional SMS deliveries from the notification queue.
- **Env:** `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_SENDER_ID`.
- **Failure:** Skip SMS; in-app + email paths can still run.

## 11. Google Sign-In

- **Purpose:** Alternate sign-in on the auth screen.
- **Where:** Firebase Auth Google provider (`firebase.json` auth block).
- **Production:** OAuth consent, authorized JavaScript origins, and authorized redirect URIs for the real domain.

## 12. Hosting / domains

- **Purpose:** Serve the TanStack Start app.
- **Where:** Vite production build. Typical host: Vercel (or equivalent Node host). Not Firebase App Hosting in the current setup.
- **Production:** Set all server env vars on the host. `FIREBASE_SERVICE_ACCOUNT_JSON` must be JSON contents, not `./file.json`.

## 13. Cloud Functions (written, not required for core beta)

- **Purpose:** Notification fan-out / FCM triggers in `functions/`.
- **Status:** Firebase project is on **Spark**. Functions cannot deploy until **Blaze**. In-app notification documents are still created via Admin SDK; email can be queued from server functions. Treat trigger-based fan-out as **not live**.

## Intentionally unused or leftover

| Item | Status |
| --- | --- |
| Daily.co | Not in the product. LiveKit is the provider. |
| Supabase client (`src/integrations/supabase`) | Leftover types/helpers. Not the runtime backend. |
| Firebase Data Connect | Present in `firebase.json` / generated packages. App data is Firestore. |
| Crane5 / Flutterwave | Wired in code. Keys are added by humans later. |
