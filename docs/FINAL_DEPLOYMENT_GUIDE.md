# Final deployment guide

This is the process that matches **this repository**. Memskool is a TanStack Start + Vite app with Nitro (Cloudflare target via `@lovable.dev/vite-tanstack-config`). Privileged work uses **TanStack Start server functions + Firebase Admin**, not a required Cloud Functions deploy. Firebase project: `memskool-4e193`, Firestore `(default)`, region `africa-south1`.

There is **no** `hosting` block in `firebase.json`. Do not run `firebase deploy` for the web app unless you add Firebase Hosting later. Do not document App Hosting unless Blaze + `apphosting.yaml` exist (they do not).

## 1. Preconditions

- Node.js compatible with the repo (`package.json` engines if present; otherwise current LTS).
- Logged in: `npx firebase login` (or CI token).
- `npx firebase use memskool-4e193` (or the intended project).
- Production secrets on the **host** (Cloudflare/Lovable), never prefixed `VITE_` except public Firebase web config. See `.env.example` and `docs/ENVIRONMENT_CONFIGURATION.md`.

## 2. Production build (application)

From the repo root:

```bash
npm ci
npx tsc --noEmit
npm run build
```

Output is Nitro/Cloudflare `.output` (and related Vite artifacts). Deploy that artifact with the same host pipeline you already use (Lovable / Cloudflare). Set production env there.

Confirm `VITE_USE_FIREBASE_EMULATORS` is not `true` in production.

## 3. Firebase rules, indexes, storage

After any change to `firestore.rules`, `firestore.indexes.json`, or `storage.rules`:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```

Phase 8 **requires** this deploy before parents can read linked-child attendance/grades under the new rules. Indexes added in Phase 8: attendance `student_id+date`, submissions `student_id+graded_at`, assessment_submissions `student_id+submitted_at`.

Syntax check without deploy:

```bash
npx firebase firestore:rules
```

(Use the Firebase CLI `deploy` dry-run / console validator if your CLI version differs. Phase 7 used CLI validation successfully.)

## 4. Auth and domains

Firebase Console → Authentication → Settings → Authorized domains: add the live hostname.

OAuth redirect URLs for Google sign-in must include that host.

## 5. Webhooks (only if those products are live)

- Flutterwave: `https://<origin>/api/public/webhooks/flutterwave` plus `FLUTTERWAVE_WEBHOOK_HASH`.
- LiveKit: `https://<origin>/api/public/webhooks/livekit` plus LiveKit API key/secret.

## 6. Public pages and robots

- Public: `/`, `/auth`, `/privacy`, `/terms`, `/reset-password`.
- Authenticated routes send `noindex`. `public/robots.txt` disallows app paths.
- After a custom domain exists, publish a sitemap for `/`, `/privacy`, `/terms` (do not invent a hostname here).
- `public/_headers` sets nosniff, referrer, frame, permissions. CSP is **not** set (would break Auth / LiveKit / payments).

## 7. Optional

- App Check: `VITE_FIREBASE_APPCHECK_SITE_KEY` and Console enforcement.
- Firestore PITR / export: `docs/BACKUP_AND_RECOVERY.md` (human, not in repo).
- Cloud Functions in `/functions`: only if you choose Blaze and need that codebase. Spark cannot deploy Functions.

## 8. Smoke after deploy

1. Open `/` signed out → landing, then create/sign-in.
2. Student dashboard loads; parent Families link; teacher assessment list.
3. Offline: banner appears when the browser is offline.
4. Confirm the host is not talking to emulators.
