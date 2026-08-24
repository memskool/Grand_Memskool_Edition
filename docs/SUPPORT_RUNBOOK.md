# Support runbook

Use this when a real user reports a problem. Do not ask them for passwords, ID tokens, or service-account JSON.

Correlate reports with: Firebase Auth uid (from the user or school admin), approximate time (UTC), school name/code, and the screen they were on. Host logs (Cloudflare/Nitro) and Firebase Console are the operators’ tools. There is no separate APM subscription in this repo.

## Cannot sign in

**Likely:** wrong password, unverified email, Google domain not authorized, claims not written.

**Check:** Firebase Auth user exists; `completeSignup` has run (profile in `users/{uid}`); custom claims `role` / `schoolId` / `approved`. Authorized domains include the live host.

**Recover:** password reset; resend verification; school admin approves teachers from the dashboard.

## Teacher tools locked

**Likely:** `membership_status` pending; claims `approved` false.

**Check:** `school_members` for that uid. Approve from school admin.

## Parent dashboard empty

**Likely:** no `parent_students` link, or an old auto-id link that does not match `{parentUid}_{studentUid}`.

**Check:** School Admin → Families. Unlink legacy rows and link again.

**Recover:** `linkParentStudent` server function writes the deterministic id.

## Permission errors on academic data

**Likely:** rules not deployed; user in the wrong school; parent reading unreleased assessments via a client query.

**Check:** `firebase deploy --only firestore:rules,firestore:indexes,storage` was run after Phase 7/8. Parent charts must use `listLinkedChildResults`.

## AI Tutor fails

**Likely:** missing `CRANE5_API_URL` / `CRANE5_API_KEY`; rate limit; provider outage.

**Check:** host env (not `VITE_`). User should see a calm retry message, not a stack.

**Recover:** restore secrets; wait on rate limit. The rest of the app should keep working.

## Live classroom will not join

**Likely:** missing LiveKit env; browser camera/mic denied; user not enrolled; session ended.

**Check:** `LIVEKIT_URL`, API key/secret; webhook URL. Ask the user whether the browser permission prompt was denied.

**Recover:** re-grant permissions; teacher starts a new session. Do not tell users video works offline.

## Assessment submit failed / double submit

**Likely:** timer already closed; network drop; attempt already submitted.

**Check:** `assessment_submissions` status and `submitted_at`. Autosave is separate from final submit — never tell a student an unsaved answer was saved.

**Recover:** if submitted, show confirmation. If not, retry on a connection. Staff can inspect attempts; they cannot invent a missing submit.

## Payment shows paid but order does not

**Likely:** webhook missed; client returned with `?ref=` before reconcile.

**Check:** `payment_events`, Flutterwave dashboard, host webhook logs. Marketplace should call `reconcileOrder` on return.

**Recover:** re-open the return URL or verify server-side. Do not let clients write `orders` paid status.

## Messages missing for an old chat

**Likely:** conversation created before `member_ids` was required.

**Recover:** start a new conversation. Do not relax membership rules.

## Escalation

1. School administrator (membership, family link, class enrolment).
2. Platform operator with Firebase Console access (Auth, Firestore, Storage, host logs).
3. Provider dashboards: Crane5, LiveKit, Flutterwave.
4. Engineering: rules/index deploy, secret rotation. Never paste secrets into tickets.
