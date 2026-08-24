# Environment configuration

See also `docs/ENVIRONMENT_SETUP.md`.

## Public (browser) — `VITE_*`

Safe: Firebase apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId, App Check site key, VAPID key, emulator flag.

Unsafe: never put service accounts, Crane5, LiveKit, Flutterwave, Resend, or webhook hashes here.

## Server

| Variable | Purpose | Launch impact if empty |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin SDK claims and privileged writes. Local: file path. Host: full JSON string. | Signup, grading, tokens, family links fail |
| `CRANE5_API_URL` / `CRANE5_API_KEY` | Proprietary tutor | Tutor UI shows “not connected”; no dummy answers |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Classroom tokens + webhook | Live join/start blocked until set |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_WEBHOOK_HASH` | Payments | Marketplace browse works; checkout paused |
| `RESEND_API_KEY` / `RESEND_FROM` | Verification, password reset, school notices | Auth mail and queued emails fail |
| `AFRICASTALKING_*` | Optional SMS | SMS deliveries skipped |
| `NOTIFICATIONS_DISPATCH_SECRET` | Optional worker | Manual flush only |
| `APP_ORIGIN` | Continue URLs / email links | Must match Firebase authorized domains |
| `LOVABLE_API_KEY` | Dashboard learning-memory insights (not tutoring) | Insight refresh paused |

The browser can ask `getPlatformCapabilities` which of these are **present**. It never receives the secret values.

Missing required secrets fail **that feature** with a generic user message. They must not crash the whole app.

Validation must **not** print secret values. `.gitignore` includes `.env` and `.env.*` (keeps `.env.example`).
