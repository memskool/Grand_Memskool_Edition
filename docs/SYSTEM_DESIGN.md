# System design

Memskool is a multi-school digital education platform. The live stack is **TanStack Start + Vite + Firebase** (Auth, Firestore `africa-south1`, Storage). Roles come from Auth custom claims. Privileged writes go through TanStack server functions and the Admin SDK.

Live video is **LiveKit**, not Daily.co. The AI Tutor is **Crane5**, called only from the server. Payments are **Flutterwave**, also server-only. Transactional email is **Resend**.

This document began as the Phase 1 Firebase migration note. The architecture below is still accurate. Product surfaces (Dream School, school admin, lessons, locker, assessments, classroom) were completed in later phases; see `docs/FINAL_COMPLETION_REPORT.md`.

---

Memskool is a multi-school education product. Phase 1 replaced Supabase with Firebase **without changing the TanStack Start frontend**.

```text
Browser (TanStack Start + React Query)
  ├─ Firebase Auth / Firestore / Storage (user-scoped, rules-enforced)
  └─ TanStack server functions (Admin SDK)
        ├─ custom claims + signup
        ├─ assessment grading (answer keys never leave the server)
        ├─ LiveKit tokens
        ├─ Flutterwave checkout / webhook apply
        └─ announcements + notification flush
Cloud Functions (written, Spark-blocked)
  └─ notification fan-out, FCM, audit triggers
```

## Tenancy

Every academic document should carry `school_id`. Authorization is **claims-based** (`role`, `schoolId`, `approved`), not client `user_metadata`. UI `RouteGuard` is not security.

## Roles

`student | teacher | parent | institution | admin | superadmin`

Institution operators use the institution UI; the Auth claim is `admin`. Teachers need `approved: true`.

## Privileged vs client writes

| Client (rules) | Admin SDK / server |
| --- | --- |
| Own locker, chat, attempts, check-in | Notifications, deliveries, payments, claims, answer keys, AI insights |

## What Phase 1 is not

No new product features. No Data Connect. No App Hosting deploy until Blaze. Do not start Phase 2.
