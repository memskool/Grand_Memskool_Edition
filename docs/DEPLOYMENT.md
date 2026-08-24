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

1. Connect the GitHub repo. Build command: `npm run build`. Node 20+.
2. Set environment variables from `.env.example`, using **real secrets** from a password manager — never from git.
3. `FIREBASE_SERVICE_ACCOUNT_JSON` must be the **JSON object as one line**, not `./something.json`.
4. Set `APP_ORIGIN` to the production URL (`https://memskool.com` or the actual host).
5. Add that origin to Firebase Auth authorized domains and to Resend continue-link allowlisting (`mail.server.ts`).

GitHub Actions (`.github/workflows/ci.yml`) typechecks, lints, runs unit checks, and builds. Do not promote a commit that fails CI.

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

## 7. Mobile / stores

The web app is responsive. Play/App Store packaging, signing, and store listings are human release tasks. Deep links should use the same production origin.

## 8. After deploy smoke list

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
