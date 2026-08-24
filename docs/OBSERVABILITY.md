# Observability

## What exists

- Server `console.error` on notification flush, LiveKit webhook, and Crane5 adapter (no secrets).
- Root and feature error boundaries report to Lovable error reporting when that integration is present.
- Firebase Console: Auth, Firestore, Storage usage; Crashlytics is **not** wired on web.
- AI usage collections (`ai_usage`, `ai_rate_limits`) are Admin-written counters.

## What we log

Operation failures with a short message. Not passwords, tokens, API keys, full student answers, or full tutor transcripts.

## What is not a monitoring stack

No Datadog/Sentry subscription was added. Until Blaze + Cloud Logging sinks are configured, operators watch Firebase Console and host logs (Cloudflare/Nitro).

Prepare alerts later for: Auth failures, webhook 4xx/5xx, Crane5 5xx, LiveKit token mint failures, Flutterwave verify failures.
