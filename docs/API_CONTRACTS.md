# API contracts (Phase 1)

TanStack `createServerFn` endpoints. The browser sends a Firebase ID token via the auth attacher.

| Function | Auth | Input | Result |
| --- | --- | --- | --- |
| `completeSignup` | newly signed-in user | role, school code, profile fields | claims written; teacher may be pending |
| `saveAssessment` | assigned teacher / manager | draft paper + questions + keys |
| `publishAssessment` / `closeAssessment` | same | lifecycle |
| `releaseAssessmentResults` | same | copies private scores; notifies |
| `startAssessmentAttempt` | enrolled student | attempt + clock + persisted order |
| `getAttemptClock` | attempt owner | `remaining_ms` |
| `saveAttemptAnswers` | attempt owner, in_progress | answers |
| `submitAssessmentAttempt` (`submitAssessment`) | attempt owner | auto-mark; scores public only if released |
| `markAssessmentAttempt` | assigned staff | manual marks; optional finalise |
| `logAssessmentIntegrity` | attempt owner | capped events |
| `generateRevisionPlan` | student | deterministic focus list |
| `recordDailyCheckIn` | student | none | idempotent +5 points |
| `reconcileOrder` | buyer | `{ reference }` | verifies Flutterwave; never trusts the query string |
| `ownerAssessmentQuestions` | assigned staff | questions **with** keys |
| `issueClassroomToken` | host, assigned teacher/admin, or enrolled student; session live | `{ sessionId }` | LiveKit JWT + `serverUrl` + publish flags |
| `startLiveSession` | assigned teacher or school admin | `{ classId, lessonId?, title? }` | Live session record |
| `endLiveSession` | host or authorized staff | `{ sessionId }` | ended + provisional attendance |
| `cancelLiveSession` | host or authorized staff | `{ sessionId }` | cancelled (no absence marks) |
| `joinLiveSession` / `leaveLiveSession` / `reportLivePresence` | authorized participant | `{ sessionId }` | participant doc |
| `sendClassroomChat` | authorized participant of a live session | `{ sessionId, body }` | message id implicit |
| `moderateLiveParticipant` | host or authorized staff | `{ sessionId, patch, targetUserId? }` | count |
| `correctLiveAttendance` | host or authorized staff | `{ sessionId, studentId, status, note? }` | ok |
| `startCheckout` | buyer | `{ itemId, quantity, scheduledAt, notes }` | `{ reference, paymentLink, amountCents, currency }` |
| `reconcileOrder` | buyer | `{ reference }` | `{ status }` |
| `flushNotifications` | any signed-in user | none | delivery counts (errors swallowed) |
| `broadcastAnnouncement` | teacher/admin | `{ classId?, title, body, includeParents }` | `{ recipients }` |
| `refreshAiInsights` | signed-in | `{ scope: student\|teacher }` | `{ dataPoints, insights }` |

## Public HTTP

`POST /api/public/webhooks/flutterwave`

- Header `verif-hash` must match `FLUTTERWAVE_WEBHOOK_HASH` (timing-safe).
- Payload is **not** trusted; the server re-fetches the transaction from Flutterwave.
- Idempotency key: `payment_events/{txRef}:{transactionId}:{status}`.

## Cloud Functions (when Blaze is on)

| Export | Trigger |
| --- | --- |
| `onNotificationCreated` | `notifications/{id}` created |
| `onDisciplinaryActionCreated` | `disciplinary_actions/{id}` created |
| `refreshUserClaims` | callable |
| `ping` | callable |
