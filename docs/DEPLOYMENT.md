# Deployment

See also `docs/ENVIRONMENT_CONFIGURATION.md`, `docs/FINAL_DEPLOYMENT_GUIDE.md`, and `docs/DEPLOYMENT_CHECKLIST.md`.

## What you are deploying

A **TanStack Start + Vite** Node app. Firebase is the backend (Auth, Firestore, Storage). This is **not** Next.js and **not** Firebase App Hosting unless you deliberately change hosts.

## 1. Firebase project

Project: `memskool-4e193` (Firestore `africa-south1`).

Deploy rules and indexes (does not require Blaze):

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,auth
```

Confirm in Console that the live rules match this repository. Code review is not a deploy.

Do **not** deploy Cloud Functions until the project is on **Blaze**.

## 2. Application host (typical: Vercel)

1. Connect the GitHub repo. Build command: `npm run build`. Set the project's Node.js version to **22.x or newer** (the function runtime is also pinned to `nodejs22.x` in `vite.config.ts`: the traced Admin SDK chain `require()`s the ESM-only `jose` v6, which throws `ERR_REQUIRE_ESM` on older Node).
2. Set environment variables from `.env.example`, using **real secrets** from a password manager — never from git.
3. `FIREBASE_SERVICE_ACCOUNT_JSON` must be the **JSON object as one line**, not `./something.json`.
4. Set `APP_ORIGIN` to the production URL (`https://memskool.com` or the actual host).
5. Add that origin to Firebase Auth authorized domains and to Resend continue-link allowlisting (`mail.server.ts`).
6. The Google Cloud / gRPC stack must stay **external** to the Nitro server bundle (`nitro.traceDeps` in `vite.config.ts`), while `firebase-admin` itself stays **bundled**. Nitro 3 inlines every dependency by default and ignores `vite.ssr.external`; inlined google-gax throws `__dirname is not defined in ES module scope`, which silently breaks every Admin SDK server function (writes then fall back to client Firestore writes that rules reject as "You do not have permission to perform this action."). Traced firebase-admin, on the other hand, `require()`s the ESM-only `jose` v6 via `jwks-rsa`, which Vercel's runtime rejects with `ERR_REQUIRE_ESM`. The tracer also symlinks multi-version packages into `node_modules/.nf3/`, which Vercel's packaging drops (`ENOENT` at runtime); a `compiled` hook in `vite.config.ts` replaces those links with real copies. `npm run check:server-bundle` guards all of this in CI.

GitHub Actions (`.github/workflows/ci.yml`) typechecks, lints, runs unit checks, builds, and verifies both bundles (`check:no-admin-client`, `check:server-bundle`). Do not promote a commit that fails CI.

## 3. LiveKit

- Put URL, API key, and secret on the host.
- In LiveKit Cloud, set the webhook to `https://<origin>/api/public/webhooks/livekit` with the same key/secret.

## 4. Flutterwave (when ready)

- Sandbox first, then live keys.
- Webhook: `https://<origin>/api/public/webhooks/flutterwave`
- Set `FLUTTERWAVE_WEBHOOK_HASH` to the secret Flutterwave signs with.

## 5. Crane5 (when ready)

Set `CRANE5_API_URL` and `CRANE5_API_KEY` on the host only. Restart the server. The tutor page will drop the “not connected” notice once `getPlatformCapabilities` reports `tutor: true`.

## 6. Email

- Verify the sending domain in Resend.
- `RESEND_FROM` must use that domain.
- Password reset and verification must be tested on the production origin, not only localhost.

## 6a. File storage (Blaze plan required)

Since 3 Feb 2026 Cloud Storage for Firebase needs the **Blaze** (pay-as-you-go) plan; Spark projects get 402/403 on every Storage call. Blaze keeps a no-cost tier, and a budget alert in Google Cloud Billing caps surprises.

1. Firebase Console → upgrade the project to Blaze (set a budget alert).
2. Console → **Storage** → **Get started** (bucket `memskool-4e193.firebasestorage.app`, or the existing default bucket).
3. Make sure Vercel's `VITE_FIREBASE_STORAGE_BUCKET` matches that bucket name, then redeploy.
4. `firebase deploy --only storage` to publish `storage.rules`.

Until then the app shows "File uploads are not switched on for Memskool yet" and written submissions still work.

### Interim: Supabase Storage (no Blaze needed)

Files can live in Supabase Storage while Firebase stays on Spark. Database, logins and roles stay on Firebase.

1. Create a Supabase project (free plan is fine). Project Settings → API: copy the **Project URL** and the **service_role** key.
2. On Vercel (server env, **not** `VITE_*`): `STORAGE_PROVIDER=supabase`, `SUPABASE_URL=<project url>`, `SUPABASE_SERVICE_ROLE_KEY=<service_role key>`. Optional: `SUPABASE_STORAGE_BUCKET` (default `memskool`, private) and `SUPABASE_PUBLIC_BUCKET` (default `memskool-public`, avatars only). Redeploy.
3. The buckets are created automatically on first use. Within ~10 minutes upload controls switch on.

Every request is checked by `authorizeStorage` (same rules as `storage.rules`) before the server hands the browser a short-lived signed URL.

**Moving back to Firebase after Blaze:** run `node scripts/copy-storage-to-firebase.mjs --dry-run`, then without `--dry-run`; set `STORAGE_PROVIDER=firebase` (or remove it) and redeploy. Paths are identical, so saved references keep working.

## 6b. Web push (device alerts)

Push is sent by the app server with the Admin SDK (`sendPushToUsers` in `src/lib/notifications.server.ts`), so it works on the Spark plan — no Cloud Functions needed. Do not also deploy `functions/` `onNotificationCreated` on Blaze, or every alert is pushed twice.

1. Firebase Console → Project settings → **Cloud Messaging** → **Web Push certificates** → **Generate key pair**.
2. Copy the public key into Vercel as `VITE_FIREBASE_VAPID_KEY` (it is a public key, safe in `VITE_*`) and redeploy.
3. Users turn alerts on per device from the bell menu ("Turn on alerts for this device"). Without the key the button stays hidden and in-app notifications still work.

## 7. Mobile / stores

The web app is responsive. Play/App Store packaging, signing, and store listings are human release tasks. Deep links should use the same production origin.

## 8. After deploy smoke list

- **Admin SDK health probe (no sign-in needed).** Find the `lookupSchoolByCode` server-function id in the deployed `school-membership-*.js` chunk (a 64-hex string), then:

  ```sh
  BODY='{"t":{"t":10,"i":0,"p":{"k":["data"],"v":[{"t":10,"i":1,"p":{"k":["code"],"v":[{"t":1,"s":"NO-SUCH-SCHOOL"}]},"o":0}]},"o":0},"f":127,"m":[]}'
  curl -s -X POST "https://www.memskool.com/_serverFn/<id>" -H "x-tsr-serverFn: true" \
    -H "accept: application/json" -H "content-type: application/json" --data "$BODY"
  ```

  A healthy server answers with a `null` result (`{"t":2,"s":1}` in the `result` slot). `"Could not verify that School ID right now (…)"` means the Admin SDK is broken on the host; the parenthetical names the cause class — `server bundle error` (bundling regression, see `npm run check:server-bundle`), `credentials` / `app/invalid-credential` (bad `FIREBASE_SERVICE_ACCOUNT_JSON`), `PERMISSION_DENIED` / `UNAUTHENTICATED` (service account lacks Firestore access), `NOT_FOUND` (wrong database id), `ERR_REQUIRE_ESM` (function runtime older than Node 22.12; the message also prints the live `node vXX` version) — and the full error is in the Vercel function logs under `[lookupSchoolByCode]`. The explicit "missing Firebase admin credentials" message means the env var is unset.

- Sign up + verification email
- Sign in + sign out
- Register school / join with School ID
- Create class + enrol student
- Publish lesson; student can open it
- Assignment submit + teacher review
- Assessment start/submit (not during an exam you care about)
- Live class start/join if LiveKit is set
- Tutor send if Crane5 is set; otherwise the disabled state
- Marketplace browse; checkout only if Flutterwave is set
