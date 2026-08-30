# Pre-Deployment Verification Guide

This guide ensures all critical components are properly configured before deploying Memskool to production.

## 🔐 Security Checklist

### Firebase Configuration

- [ ] **Firestore rules deployed** to production Firebase project
  - Run: `firebase deploy --only firestore:rules`
  - Verify rules in Firebase Console match `firestore.rules`
  - Test rules with different roles using Firestore emulator

- [ ] **Storage rules deployed** to production Firebase project
  - Run: `firebase deploy --only storage:rules`
  - Verify size/MIME type restrictions are active

- [ ] **Firestore indexes deployed** if required
  - Run: `firebase deploy --only firestore:indexes`
  - List needed indexes: `firebase firestore:indexes`

- [ ] **Firebase Admin SDK configured** on server
  - `FIREBASE_SERVICE_ACCOUNT_JSON` set (JSON string on Vercel, file path locally)
  - Verify JSON has `project_id`, `private_key`, `client_email`
  - Service account has Editor role in Firebase Console

- [ ] **Auth authorized domains configured**
  - In Firebase Console > Auth > Settings > Authorized domains
  - Add: production domain, www.domain, and any staging/preview domains

### Environment Variables

- [ ] All required variables set (check with `npm run typecheck`)
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `GCLOUD_PROJECT`
  - `LIVEKIT_URL` (if using live classrooms)

- [ ] All secrets stored securely
  - Never commit `.env` file
  - Use Vercel Secrets for production
  - Use 1Password or similar for team sharing

- [ ] Sensitive keys are server-only
  - `FIREBASE_SERVICE_ACCOUNT_JSON` — never VITE_ prefix
  - `CRANE5_API_KEY` — never VITE_ prefix
  - `FLUTTERWAVE_SECRET_KEY` — never VITE_ prefix
  - `LIVEKIT_API_SECRET` — never VITE_ prefix

### Tenant Isolation

- [ ] Test school isolation with dual-account login
  - Create two school admin accounts
  - Verify School A admin cannot read School B data
  - Check Firestore rules are enforcing `school_id` match

- [ ] Verify custom claims are set correctly
  - Check Firebase Console > User > Custom Claims
  - `role`, `schoolId`, and `approved` fields present
  - Role values: `student`, `teacher`, `parent`, `admin`, `superadmin`

## 🚀 External Services

### LiveKit (if using live classrooms)

- [ ] LiveKit project created (cloud or self-hosted)
- [ ] `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` configured
- [ ] Webhook configured in LiveKit Console
  - URL: `https://<your-domain>/api/public/webhooks/livekit`
  - API key matches server config
- [ ] Test: Teacher can start a live class and student can join

### Flutterwave (if using payments)

- [ ] Flutterwave account created (sandbox first for testing)
- [ ] `FLUTTERWAVE_SECRET_KEY` configured (not public key)
- [ ] Webhook hash configured in Flutterwave Dashboard
  - Get from: Settings > Webhooks > Copy hash
  - Set as `FLUTTERWAVE_WEBHOOK_HASH` env var
- [ ] Webhook URL configured
  - URL: `https://<your-domain>/api/public/webhooks/flutterwave`
- [ ] Test: Create a test order and verify payment reconciliation

### Crane5 (if using AI tutor)

- [ ] Crane5 API endpoint obtained
- [ ] `CRANE5_API_URL` and `CRANE5_API_KEY` configured
- [ ] Test: Student can ask a question in tutor and get a response
- [ ] Verify rate limiting is working (Phase 4 gateway limits)

### Resend (if sending emails)

- [ ] Resend account created
- [ ] Domain verified in Resend Console (e.g., notifications@memskool.com)
- [ ] `RESEND_API_KEY` configured
- [ ] `RESEND_FROM` email set correctly
- [ ] Test: Send password reset email and verify delivery

## 📊 Data & Backups

- [ ] **Firestore backups enabled**
  - Enable Point-in-Time Recovery (PITR) if Enterprise
  - Or configure scheduled exports to Cloud Storage
  - Test restore procedure

- [ ] **Cloud Storage backups**
  - Configure lifecycle policy for old files (if needed)
  - Educate users about storage limits

- [ ] **Database schema verified**
  - Run: `firebase firestore:get-metadata --database=default`
  - Confirm all expected collections exist
  - Verify no sensitive data in default view

## ✅ Functionality Checks

### Authentication

- [ ] Email/password sign-up works
- [ ] Email verification emails are sent
- [ ] Password reset flow works end-to-end
- [ ] Google sign-in works
- [ ] Superadmin cannot self-assign at signup
- [ ] Teacher/Institution require school code/name

### Role-Based Access

- [ ] Student dashboard shows correct data
- [ ] Teacher dashboard shows correct classes
- [ ] Parent dashboard shows only linked child
- [ ] Admin sees school-scoped data only
- [ ] Role restrictions are enforced on API endpoints

### Critical Features

- [ ] Assessments: Teacher can create, publish, and release results
- [ ] Students: Can attempt assessments with timer working
- [ ] Grading: Auto-marking works for MC/True-False
- [ ] Live classrooms: Can start, join, and end sessions
- [ ] Chat: Messages appear only in correct session
- [ ] Payments: Orders show correct status after reconciliation

## 🔍 Compliance & Legal

- [ ] `/privacy` and `/terms` pages reviewed by legal (or marked as notices)
- [ ] GDPR/data residency requirements met (Firestore in africa-south1)
- [ ] Student data deletion policy documented
- [ ] Parent consent flow documented (if collecting from minors)
- [ ] Terms of Service updated with any third-party services

## 📋 Deployment Readiness

- [ ] Production build succeeds
  - Run: `npm run build`
  - No errors or warnings

- [ ] ESLint passes
  - Run: `npm run lint`
  - Fix any new violations

- [ ] TypeScript strict mode passes
  - Run: `npm run typecheck`
  - No type errors

- [ ] Unit tests pass
  - Run: `npm test`
  - All assertions pass

- [ ] Performance checked
  - Lighthouse score > 70 on desktop
  - No N+1 queries on dashboard load
  - Chat/marketplace queries bounded

- [ ] Error tracking configured
  - Errors are captured and visible in logs
  - Test: Trigger an error and verify it appears in logs

- [ ] Logging configured
  - Critical operations (auth, payments, live sessions) are logged
  - Logs do not contain PII or secrets

## 🧪 Production Smoke Tests

After deployment:

1. **Sign up** with new email → verify user profile created
2. **Invite school** → verify school document created
3. **Add student** → verify class enrollment created
4. **Start assessment** → verify attempt timer counting down
5. **Submit assessment** → verify results calculated
6. **Start live class** → verify session created and LiveKit token issued
7. **Send chat** → verify message stored and broadcast
8. **Make payment** → verify order created and webhook processed (if Flutterwave enabled)
9. **Monitor errors** → verify stack traces visible in logs

## 🚨 Emergency Rollback Plan

- [ ] Previous Firebase rules snapshot saved
- [ ] Database backup point identified
- [ ] Rollback procedure documented
- [ ] On-call engineer assigned for first 24 hours

---

## Startup Validation

The app includes automatic environment validation on startup. If any required configuration is missing, the server will exit immediately with clear error messages.

Enable this in production by importing and calling `logStartupValidation()` in `src/server.ts`:

```ts
import { logStartupValidation } from "@/lib/startup-validation";

if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
  logStartupValidation();
}
```

---

**Last Updated:** 2026-08-30  
**Status:** Ready for Beta Launch (with checklist complete)
