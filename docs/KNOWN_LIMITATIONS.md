# Known limitations

Honest list of what the product does **not** do yet, or does only when a human configures it.

## External credentials (expected)

- Crane5 tutor does not answer until `CRANE5_API_URL` and `CRANE5_API_KEY` are set.
- Flutterwave checkout does not run until `FLUTTERWAVE_SECRET_KEY` (and webhook hash) are set.
- Dashboard insight refresh needs `LOVABLE_API_KEY`. This is separate from the tutor.
- LiveKit join fails if URL/key/secret are missing on the **host**, even if they work locally.

## Platform / billing

- Firebase project is Spark unless upgraded. Cloud Functions and App Hosting deploys are blocked.
- Notification **documents** are real. Automatic FCM fan-out from Functions is not live on Spark.
- Point-in-time recovery and scheduled exports are Console actions, not repository files.

## Product scope (intentional)

- Superadmin sees a school directory (names/locations), not another school’s private records.
- Parents see a child only after School Admin → Families creates `parent_students/{parentUid}_{studentUid}`. Legacy auto-id links do not unlock reads.
- Parents do not see unreleased assessment papers.
- AI is not a final exam marker. Streaming tutor replies are not implemented.
- Live classroom has no cloud recording/egress, live captions, or parent live view.
- Marketplace listings can be created by teachers/admins; money movement waits on Flutterwave.
- Gold tutor earnings are **pending settlement** after a verified Flutterwave payment. Split payouts to tutors are not configured; do not treat pending totals as transferred money.
- Gold live lessons reuse LiveKit. They fail if LiveKit host credentials are missing. Cloud recording is not implemented.
- Gold resource uploads currently accept a URL the tutor provides. Direct Storage uploads to `gold/{tutorId}/` are allowed by rules but not wired as a picker in the first UI.
- Home plays original uploaded files from Firebase Storage (signed URLs). There is no transcoding, HLS/DASH adaptive bitrate, or automatic thumbnail generation.
- Home view counts increment at most once per signed-in user per clip per 12 hours. Anonymous plays are not counted.
- Home clips stay unpublished until a superadmin approves them. Rules/indexes must be deployed before production traffic.
- Offline: a network banner is honest. The app does not claim a full offline school.

## Engineering

- No device-lab or browser-matrix certification in CI.
- No end-to-end Playwright/Cypress suite. CI runs typecheck, lint, unit checks, and production build.
- Content-security-policy headers are not fully locked down on the host.
- Old direct messages without `member_ids` are not backfilled.
- Dual academic write paths from earlier phases still exist in places; do not add a third.
- `src/integrations/supabase` and Data Connect artifacts are leftover and unused by the live app.

## Legal

- `/privacy` and `/terms` are product notices, not counsel-reviewed contracts.
