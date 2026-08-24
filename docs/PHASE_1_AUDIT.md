# Phase 1 Architecture Audit — Memskool

**Date:** 2026-08-22  
**Project:** Memskool (`memskool-4e193`)  
**Status:** Audit complete. No production code was changed before this document existed.

This document is the required Phase 1 inventory. Implementation follows the migration strategy in the last section.

---

## Current Architecture

| Layer | Current implementation |
| --- | --- |
| Framework | **TanStack Start** on **Vite 8** (not Next.js). Config via `@lovable.dev/vite-tanstack-config`. SSR entry `src/server.ts`. |
| Language | TypeScript 5.8, `strict: true` (including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). |
| Styling | Tailwind CSS 4, shadcn/Radix UI, Inter font, custom “surface-card” / sidebar tokens in `src/styles.css`. |
| State | TanStack React Query 5. Auth session in React state via `useSession`. No Zustand. |
| Routing | TanStack Router file routes under `src/routes`. Generated tree: `src/routeTree.gen.ts`. |
| Backend | **Supabase** (Postgres + Auth + Storage + RLS) accessed from the browser SDK and from TanStack **server functions**. |
| Database | Supabase Postgres project `qkabqhlqfxnzvjktqvqq`. Schema is encoded in `src/integrations/supabase/types.ts` (no local SQL migrations in-repo). |
| Authentication | Supabase email/password, email confirmation, password reset. Google OAuth via **Lovable Cloud** (`lovable.auth.signInWithOAuth`), not native Supabase Google. |
| Storage | Supabase Storage buckets `locker-files` and `library-files` (`src/lib/content-data.ts`, `src/lib/storage.ts`). |
| External integrations | LiveKit (live class tokens), Flutterwave (orders/webhooks), Resend (email), Africa’s Talking (SMS), Lovable email/webhooks/cron, Firebase (configured but unused by the app). |
| Hosting (current app) | Lovable Cloud / Cloudflare Nitro target. Firebase App Hosting is **not** wired; Blaze billing is required and currently **disabled**. |

### Folder structure (application)

```text
src/
  routes/                 # file-based pages + API routes
  components/app/         # product UI (shell, dashboards, locker, classroom…)
  components/ui/          # shadcn primitives
  components/dashboards/  # Student, Teacher, Parent, Institution dashboards
  hooks/useAuth.tsx       # session, profile, role
  integrations/supabase/  # clients, generated Database types, auth middleware
  integrations/lovable/   # Google OAuth + Lovable Cloud
  lib/                    # domain data hooks (*-data.ts) and *.functions.ts server fns
  dataconnect-generated/  # unused Firebase Data Connect SDK stubs
functions/                # Cloud Functions stub (hello-world commented out)
dataconnect/              # unused FDC schema (europe-west2 / memskool-fdc)
firestore.rules           # OPEN until 2026-09-20 (unsafe)
```

### Routing

**Public**

| Route | File |
| --- | --- |
| `/` | `src/routes/index.tsx` (marketing; redirects if session) |
| `/auth` | `src/routes/auth.tsx` |
| `/reset-password` | `src/routes/reset-password.tsx` |
| `/api/public/webhooks/flutterwave` | webhook |
| `/api/public/notifications/dispatch` | cron-style dispatch |
| `/lovable/email/auth/*` | Lovable email tooling |

**Authenticated** (`src/routes/_authenticated/route.tsx` — `supabase.auth.getUser()` or redirect `/auth`)

`/dashboard`, `/locker`, `/missed-work`, `/virtual-classroom`, `/timetable`, `/messages`, `/library`, `/ai-tutor`, `/assessments`, `/exam/$assessmentId`, `/dream-school`, `/marketplace`, `/school-admin`, `/settings`

UI-only role gating: `RouteGuard` + `navForRole` (`src/lib/nav.ts`, `src/lib/access.ts`). **This is not security.**

### Roles in the existing product

`AppRole = "student" | "teacher" | "parent" | "admin" | "institution"`

There is **no `superadmin`** in the current frontend. School operators sign up as **institution**. Teachers require school approval (`pendingApproval`).

Signup writes `role` into **user_metadata** (`auth.tsx`). That is client-controlled and unsafe as an authorization source (same class of bug as Supabase `user_metadata` in JWTs).

---

## Current Database

**Engine:** Supabase Postgres (PostgREST 14.15 types).  
**Initialized:**

- Browser: `src/integrations/supabase/client.ts` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`)
- Admin (bypasses RLS): `src/integrations/supabase/client.server.ts` (`SUPABASE_SERVICE_ROLE_KEY`)
- Per-request user client: `src/integrations/supabase/auth-middleware.ts`

**Tables (from generated types)**

`ai_insights`, `assessment_questions`, `assessment_submissions`, `assessments`, `assignments`, `attendance`, `class_enrollments`, `classes`, `classroom_messages`, `classroom_participants`, `classroom_sessions`, `conversation_members`, `conversations`, `disciplinary_actions`, `learning_profiles`, `lesson_resources`, `library_books`, `locker_folders`, `locker_items`, `marketplace_items`, `messages`, `missed_work`, `notification_deliveries`, `notification_preferences`, `notifications`, `orders`, `parent_students`, `payment_events`, `profiles`, `reward_events`, `school_applications`, `school_meetings`, `school_members`, `school_roster`, `schools`, `study_reminders`, `subjects`, `submissions`, `timetable_slots`, `user_relations`, `user_roles`

**RPCs:** `has_role`, `is_approved_member`, `is_enrolled`, `is_parent_of`, `lookup_school`, `my_school_id`, `owns_school`, `submit_assessment`, `teaches_class`, and others.

**Local SQL:** `supabase/config.toml` only. No migration SQL in this clone. Live schema lives in the remote Supabase project.

### Firebase project already present (unused by UI)

| Item | Value |
| --- | --- |
| Project | `memskool-4e193` / display name `memskool` |
| Firestore | `(default)`, **Enterprise**, `africa-south1`, native |
| Auth apps | Web app `cursor-access-probe` only |
| Billing | **Not enabled** (Spark). Blocks Cloud Functions deploy, App Hosting, some App Check providers. |
| Data Connect | Configured, not used by the TanStack app |
| Functions | Empty `functions/src/index.ts` |
| Rules | Globally open until 2026-09-20 |

---

## Existing Backend Dependencies

Every file below talks to Supabase or a secret-backed server API.

### Clients / middleware

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/auth-attacher.ts`
- `src/integrations/supabase/cron-auth.ts`
- `src/integrations/supabase/types.ts`
- `src/start.ts` (registers `attachSupabaseAuth`)

### Auth / session

- `src/hooks/useAuth.tsx`
- `src/routes/auth.tsx`
- `src/routes/reset-password.tsx`
- `src/routes/index.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/settings.tsx`
- `src/components/app/UserMenu.tsx`
- `src/integrations/lovable/index.ts` (Google OAuth)

### Domain data (client Query hooks)

- `src/lib/school-membership.ts`
- `src/lib/school-manage.ts`
- `src/lib/school-data.ts`
- `src/lib/content-data.ts` (locker + library)
- `src/lib/storage.ts`
- `src/lib/assignments-data.ts`
- `src/lib/assessment-data.ts`
- `src/lib/classroom-data.ts`
- `src/lib/messaging-data.ts`
- `src/lib/notifications-data.ts`
- `src/lib/discovery-data.ts`
- `src/lib/discipline-data.ts`
- `src/lib/marketplace-data.ts`
- `src/lib/rewards-data.ts`
- `src/lib/learning-memory.ts`

### Server functions / routes (must not ship service role to the client)

- `src/lib/school-lookup.functions.ts`
- `src/lib/payments.functions.ts`
- `src/lib/payments.server.ts`
- `src/lib/payments-apply.server.ts`
- `src/lib/notifications.functions.ts`
- `src/lib/notifications.server.ts`
- `src/lib/livekit.functions.ts`
- `src/lib/learning-memory.functions.ts`
- `src/routes/api/public/webhooks/flutterwave.ts`
- `src/routes/api/public/notifications/dispatch.ts`
- `src/routes/lovable/email/auth/webhook.ts`
- `src/routes/lovable/email/auth/preview.ts`

### Dashboards (consume the data hooks)

- `src/components/dashboards/StudentDashboard.tsx`
- `src/components/dashboards/TeacherDashboard.tsx`
- `src/components/dashboards/ParentDashboard.tsx`
- `src/components/dashboards/InstitutionDashboard.tsx`

---

## Existing Frontend Dependencies

UI expects the same hook contracts (loading / data / mutate). Screens must keep working; only the data source changes.

| Feature | Primary UI | Data source today |
| --- | --- | --- |
| Auth screens | `auth.tsx`, `reset-password.tsx` | Supabase Auth + Lovable Google |
| Shell / nav | `AppShell`, `AppSidebar`, `MobileNav`, `RouteGuard` | `useAccess` → `useRole` + `useMySchool` |
| Dashboards | four role dashboards | `school-data.ts` |
| Locker / library / missed work | routes + `content-data.ts` | Postgres + Storage |
| Assessments / exams | `assessments.tsx`, `exam.$assessmentId.tsx`, `AssessmentBuilder` | `assessment-data.ts` |
| Assignments | `TeacherAssignmentPanel` | `assignments-data.ts` |
| Live class | `virtual-classroom.tsx`, `ClassroomRoom` | `classroom-data.ts` + LiveKit server fn |
| Messages | `messages.tsx` | `messaging-data.ts` |
| Dream School | `dream-school.tsx` | `discovery-data.ts` |
| School admin | `school-admin.tsx` | membership + manage + roster |
| Settings | `settings.tsx` | profile + school join |
| Notifications | `NotificationBell` | `discovery-data` + prefs |
| Marketplace / checkout | `marketplace.tsx`, `CheckoutModal` | `marketplace-data` + Flutterwave |
| AI tutor | `ai-tutor.tsx` | `learning-memory.ts` + Lovable API key on server |
| Rewards / discipline | widgets / panels | `rewards-data`, `discipline-data` |

Loading/empty/error already exist in several places (`ListSkeleton`, `EmptyState`, toasts). Phase 1 must keep those patterns and apply them to Firebase-backed hooks.

---

## Environment variables (current)

**Public (already in `.env` from the GitHub clone — publishable keys):**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Server (documented in `.env.example`, not all populated):**

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM`
- `AFRICASTALKING_*`
- `NOTIFICATIONS_DISPATCH_SECRET`, `APP_ORIGIN`
- `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`, `LOVABLE_CRON_SECRET`

**Secrets in source:** no private keys found in TS. `.env` in the cloned repo contains Supabase **publishable** keys (acceptable for client, should not be committed going forward). `.gitignore` already ignores `.env`.

---

## Risks

1. **Open Firestore rules** on `memskool-4e193` until 2026-09-20 — anyone with the project config can read/write. Must replace before any real data is written.
2. **Client-assigned roles** via `user_metadata.role` — privilege escalation if migrated as-is.
3. **UI-only authorization** (`RouteGuard`) — must be backed by Security Rules + custom claims.
4. **Service-role usage** in server functions is correct for admin ops; a naive client Firestore port would either lock the app or open the database.
5. **No Blaze billing** — cannot deploy Cloud Functions, App Hosting, or some App Check setups. Emulators can still test Functions locally.
6. **Relational → document model** — naive 1:1 table copies will be slow and expensive (joins, `count` heads, `ilike` school codes).
7. **Google sign-in** currently depends on Lovable; Firebase Google provider needs authorized domains (`localhost`) and OAuth consent.
8. **Email confirmation / reset** currently use Supabase mail. Firebase needs Authentication email templates + authorized domains.
9. **LiveKit / Flutterwave / Resend** stay; only their persistence layer moves. Do not rebuild payment/live-class product flows in Phase 1.
10. **Data Connect + Genkit stubs** can confuse the stack. Leave unused; do not delete until Firebase Auth/Firestore is proven. Do not make FDC the system of record (Phase 1 is Firestore).
11. **No historical data migration** of the live Supabase dataset is in scope unless requested; Phase 1 replaces the *runtime* backend. Existing Supabase data remains in Supabase until a later ETL.
12. **Lovable git coupling** (`AGENTS.md`) — do not rewrite published history.

---

## Migration Strategy

### Principle

Preserve hook names and UI. Replace the internals of `src/lib/*-data.ts` and auth with Firebase. Remove `@supabase/supabase-js` only after those call sites work.

### Step 1 — Inventory

Completed in this document.

### Step 2 — Map (current → Firebase)

| Current | Affected UI | Domain | Firebase replacement |
| --- | --- | --- | --- |
| `supabase.auth.*` | auth pages, shell | Identity | Firebase Auth (email/password + Google) |
| `profiles` + `user_roles` | `useAuth`, settings | Users / RBAC | `users/{uid}` + **custom claims** `{ role, schoolId }` |
| `schools`, `school_members`, roster | signup, school-admin | Tenancy | `schools/{id}`, `schoolMembers/{id}` |
| Locker / library files | locker, library | Storage | Firebase Storage paths under `users/` and `schools/` |
| Assignments, assessments, attendance, classes… | dashboards, feature routes | Academic data | Top-level collections with `schoolId` + indexes |
| `notifications` + deliveries | bell, dispatch route | Messaging | Firestore `notifications` + FCM token docs; send via Functions later |
| Orders / Flutterwave | marketplace | Payments | Keep Flutterwave server routes; persist orders in Firestore |
| LiveKit token fn | classroom | Live class | Keep LiveKit secrets server-side; persist sessions in Firestore |
| AI insights / learning profiles | AI tutor | AI boundary | `src/features/ai` service; no provider secrets on client |
| Audit | (none today) | Security | `auditLogs` written **only** by Admin SDK / Functions |
| RPCs (`has_role`, …) | implicit in RLS | AuthZ | Security Rules helpers + claims |

**Role mapping**

| Product role | Claim `role` | Notes |
| --- | --- | --- |
| student | `student` | Must match roster when school-bound |
| teacher | `teacher` | `status: pending \| approved` |
| parent | `parent` | Linked via `parentStudents` |
| institution / school admin | `admin` | UI label stays “School / Institution” |
| (new) platform operator | `superadmin` | Never self-assigned; bootstrap via env allowlist on Functions |

### Step 3 — Create Firebase replacement first

1. Central client SDK (`src/lib/firebase/client.ts`) and Admin SDK (`src/lib/firebase/admin.server.ts`).
2. Typed domain models + Zod parsers.
3. Feature services used by existing hooks.
4. Cloud Functions: `onUserCreate` profile, `finalizeSignup` claims, `setUserRole` (superadmin only), `writeAuditLog`, FCM send stub.
5. Production-quality Firestore + Storage rules (default deny).
6. Emulator suite for local tests.

### Step 4 — Migrate incrementally

Order: Auth → profiles/roles/schools → locker/storage → remaining `*-data.ts` files → server functions (LiveKit, payments, notifications, school lookup) → remove Lovable Google path for login.

### Step 5 — Validate

Emulator tests + live project smoke tests (Auth, rules, isolation) after rules deploy.

### Step 6 — Remove

Supabase clients, types, middleware, `@supabase/supabase-js`, `VITE_SUPABASE_*` once no imports remain.

### Step 7 — Clean

Dead env vars, unused Lovable auth for Google (keep Lovable email routes if still referenced until Phase 2), empty Data Connect not deleted (non-blocking, unused).

### Firestore access pattern (not a SQL clone)

Top-level collections (queryable, indexable) with mandatory `schoolId` where tenant-owned:

`users`, `schools`, `schoolMembers`, `schoolRosters`, `classes`, `classEnrollments`, `subjects`, `timetableSlots`, `attendance`, `assignments`, `submissions`, `assessments`, `assessmentQuestions`, `assessmentSubmissions`, `lockerFolders`, `lockerItems`, `libraryBooks`, `missedWork`, `classroomSessions`, `classroomParticipants`, `classroomMessages`, `conversations`, `conversationMembers`, `messages`, `notifications`, `notificationPreferences`, `fcmTokens`, `parentStudents`, `userRelations`, `disciplinaryActions`, `rewardEvents`, `marketplaceItems`, `orders`, `schoolApplications`, `schoolMeetings`, `studyReminders`, `aiInsights`, `learningProfiles`, `signupRequests`, `auditLogs`

Security Rules: authenticated; membership/`schoolId` match; role from **token claims**; `auditLogs` and privileged fields Admin-only.

### What Phase 1 will not do

- Full Flutterwave production checkout hardening
- Full FCM fan-out / email/SMS product workflows (foundation only)
- Historical ETL from Supabase Postgres
- Flutter app
- Firebase App Hosting deploy (billing)
- Redesign of screens, branding, or navigation labels

---

## Human actions required (blockers)

1. **Enable Blaze billing** on `memskool-4e193` before Cloud Functions or App Hosting can be deployed.  
   Console: [usage/details](https://console.firebase.google.com/project/memskool-4e193/usage/details)
2. **Enable Email/Password and Google** in Authentication (CLI `deploy --only auth` after `firebase.json` auth block).
3. **Create a Storage bucket** (CLI or console) in a region close to Firestore (`africa-south1` if available).
4. **App Check reCAPTCHA v3 site key** (optional until production) — paste into `VITE_FIREBASE_APPCHECK_SITE_KEY`.
5. **Google Cloud OAuth consent** for Google sign-in.
6. **Do not use the open default Firestore rules** after go-live.

Until billing is enabled, Functions will be developed and tested against the **emulator**.
