# Environment configuration

See also `docs/ENVIRONMENT_SETUP.md`.

## Public (browser) — `VITE_*`

Safe: Firebase apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId, App Check site key, VAPID key, emulator flag.

Unsafe: never put service accounts, Crane5, LiveKit, Flutterwave, or webhook hashes here.

## Server

| Variable | Purpose |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin SDK claims and privileged writes |
| `CRANE5_API_URL` / `CRANE5_API_KEY` | Proprietary tutor |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Classroom tokens + webhook |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_WEBHOOK_HASH` | Payments |
| Dispatch / email / SMS keys | Notification fan-out |

Missing required secrets should fail the specific feature with a generic user message, not crash the whole app (current pattern for Crane5 and LiveKit).

Validation must **not** print secret values. `.gitignore` includes `.env` and `.env.*` (keeps `.env.example`).
