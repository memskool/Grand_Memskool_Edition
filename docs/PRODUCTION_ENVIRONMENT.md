# Production environment

Firebase project: `memskool-4e193`, Firestore `(default)` Enterprise, region `africa-south1`.

| Layer | Production expectation |
| --- | --- |
| App | TanStack Start build (`.output`). Hosting target is Cloudflare/Nitro unless you later enable App Hosting on Blaze. |
| Auth | Custom claims `role`, `schoolId`, `approved`. Google + email. Authorized domains must include the live host. |
| Firestore / Storage | Deploy `firestore.rules`, `firestore.indexes.json`, `storage.rules`. |
| Server secrets | `FIREBASE_SERVICE_ACCOUNT_JSON`, `CRANE5_*`, `LIVEKIT_*`, `FLUTTERWAVE_*`, optional Resend / Africa’s Talking. Never `VITE_` prefix. |
| Client | `VITE_FIREBASE_*` only (public). |
| Webhooks | `https://<origin>/api/public/webhooks/flutterwave` and `/livekit`. |
| Billing | Spark until Blaze: no Cloud Functions / App Hosting deploy. |

Do not point production at emulators (`VITE_USE_FIREBASE_EMULATORS`, `*_EMULATOR_HOST`).
