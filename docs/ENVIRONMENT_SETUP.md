# Environment setup

Firebase project: `memskool-4e193` (Africa South 1). Copy `.env.example` to `.env`.

## Client (browser)

Set every `VITE_FIREBASE_*` value from Firebase Console → Project settings → **Memskool Web**. These are public client identifiers, not secrets.

Optional:

- `VITE_FIREBASE_APPCHECK_SITE_KEY` — reCAPTCHA v3 site key. App Check stays off until this is set.
- `VITE_FIREBASE_VAPID_KEY` — Cloud Messaging web push certificate. FCM registration is a no-op without it.
- `VITE_USE_FIREBASE_EMULATORS=true` — Auth `9099`, Firestore `8080`, Storage `9199`, Functions `5001`.

## Server (TanStack Start + Admin SDK)

Privileged operations (`completeSignup`, assessment grading, payments, LiveKit tokens, announcements) use `firebase-admin`.

1. Prefer emulators locally (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`).
2. For a real project, set `FIREBASE_SERVICE_ACCOUNT_JSON` to the **full JSON string** of a service account that can mint custom claims.
3. Or run `gcloud auth application-default login` and `gcloud config set project memskool-4e193`.

Never prefix service-account material with `VITE_`.

## Billing and deploy

The project is on **Spark**. Cloud Functions and App Hosting cannot be deployed until **Blaze** is enabled. Rules, indexes, Auth, and Storage can still be deployed:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,auth
```

## Other secrets

Keep Flutterwave, LiveKit, Resend, and Africa’s Talking keys server-only, as in `.env.example`.

## Google sign-in

Authorized domains must include `localhost`. OAuth consent and the Google provider are configured on `memskool-4e193`; `firebase deploy --only auth` may still be required for them to take effect.
