# Phase 2 audit — Memskool

**Date:** 2026-08-22  
**Method:** Phase 1 docs were read, then the live `src/` implementation was inspected. Documentation is not treated as source of truth.

---

## 1. Current application state

Phase 1 did land a real Firebase foundation: Auth client, Admin SDK, Firestore repo, custom claims signup, rules, and the `*-data.ts` layer. The TanStack Start UI was preserved.

The product still **does not feel finished as an identity engine**:

- Session state is duplicated per `useSession()` mount (each component attaches its own `onAuthStateChanged`).
- `useProfile` **invents** a `"Member"` profile when `users/{uid}` is missing, which hides incomplete onboarding.
- Google sign-in never calls `completeSignup`, so those users can reach `/dashboard` with no Firestore profile and no claims.
- After `completeSignup`, the ID token is not force-refreshed, so role/nav can stay wrong until the next token refresh.
- Superadmin falls through to **StudentDashboard**.
- Claim `admin` is mapped to UI `institution`, so `AdminDashboard` is effectively unreachable.
- Teacher approval updates `school_members.status` only — **custom claims `approved` are not refreshed**.
- Authenticated layout does not preserve the intended URL on login.
- No dedicated onboarding recovery route.

Feature screens (locker, assessments, classroom, marketplace, etc.) already exist and talk to Firestore. Phase 2 must not rebuild them. It must make **entry, identity, nav, and shell** production-quality.

---

## 2. Authentication status

| Flow | Code | Status |
| --- | --- | --- |
| Email sign up | `auth.tsx` → `signUpEmail` + `completeSignup` | Present. Token not refreshed after claims. |
| Email sign in | `signInEmail` | Present. Always goes to `/dashboard`. |
| Google | `signInWithGoogle` | Present. **No profile/claims completion.** |
| Sign out | `UserMenu` | Present. Clears React Query. |
| Password reset request | Forgot mode on `/auth` | Present. |
| Password reset complete | `/reset-password` (`oobCode`) | Present. |
| Session restore | `authStateReady` in `getCurrentAuthUser` | Present for route `beforeLoad`. |
| Email verification | Best-effort send; dashboard still allowed | Incomplete UX. |
| Friendly errors | `toUserMessage` / `classifyFirebase` | Present; needs a dedicated auth translator with the Phase 2 copy. |
| Token on server fns | `attachFirebaseAuth` | Uses `currentUser` **without** `authStateReady` — first RPC after refresh can miss the token. |

`src/integrations/supabase/*` still exists but is unused by feature code.

---

## 3. Existing user flows

1. `/` → redirect `/dashboard` or `/auth`.
2. `/auth` create account (student / parent / teacher / institution) → dashboard.
3. Teacher pending: can open dashboard/messages/settings; other routes show RouteGuard empty state.
4. Institution dashboard: school code, members, roster (real Firestore).
5. Parent dashboard: empty state if no `parent_students` rows (good).
6. Settings: name, phone, password, notification prefs, receipts.
7. No flow for “Auth user, missing `users` doc”.
8. `useRemindSchool` is a **no-op**.

---

## 4. Existing routes

| Path | Guard |
| --- | --- |
| `/`, `/auth`, `/reset-password` | Public |
| `/_authenticated/*` | Firebase user required; `AppShell` + client `RouteGuard` |
| `/dashboard`, `/settings`, `/locker`, `/library`, `/timetable`, `/virtual-classroom`, `/messages`, `/assessments`, `/exam/:id`, `/missed-work`, `/ai-tutor`, `/dream-school`, `/marketplace`, `/school-admin` | Role nav |

Missing: `/onboarding`. No `redirect` search param on `/auth`.

---

## 5. Existing role-based experiences

`src/lib/nav.ts` is the client source of truth. `RouteGuard` uses `canAccessRoute`. Server rules remain the authority.

| Role | Landing | Notes |
| --- | --- | --- |
| student | `StudentDashboard` | Wired to enrollments/assignments/locker. |
| teacher | `TeacherDashboard` | Pending approval via `useAccess`. |
| parent | `ParentDashboard` | Safe empty state. |
| institution | `InstitutionDashboard` | School operator (claim `admin`). |
| admin | `AdminDashboard` | Unreachable via `claimsRoleToAppRole`. |
| superadmin | **StudentDashboard** | Bug. Nav currently copies admin (too much school UI). |

`canManageSchool` omits `superadmin` (fine for UI). Superadmin must not be treated as a school operator.

---

## 6. Mock / hardcoded data

No fixture JSON users. Remaining issues are **synthetic identity**:

- Fabricated profile when Firestore doc missing.
- Superadmin shown as a student.
- Google users without claims default role `student` in `useRole`.
- Theme is localStorage only (acceptable for appearance).
- Exam mode is sessionStorage (keep).

Do not strip locker/assessments empty states — those are real Firestore empties.

---

## 7. Broken / incomplete interactions

- Google → dashboard with no profile.
- Stale claims after signup.
- Teacher approve does not update JWT `approved`.
- User menu has no Settings/profile link; avatar ignores `avatar_url`.
- Settings `useProfile` does not return `phone` (cast workaround).
- Notification bell: no loading/error; links may be invalid route strings.
- Auth attacher race after refresh.
- Signed-in visit to `/auth` always dashes to dashboard, even if onboarding incomplete.

---

## 8. Responsive issues

- Mobile bottom nav + overlay menu exist (`md:hidden`); desktop sidebar exists.
- Auth card `max-w-md` is fine; role picker is 2-column (tight on 320px).
- Dashboard grids already use `sm:` / `lg:` breakpoints.
- Bottom nav `pb-[env(safe-area-inset-bottom)]` is present.
- Skip link missing.
- Touch targets on bottom tabs are small (`h-7`).
- Header controls can crowd on small screens (theme + bell + avatar).

---

## 9. Accessibility issues

- Root 404/error buttons are `<button>`/`<a>` without shared Button semantics in places; auth role picker uses `aria-pressed` (good).
- Notification popover has `aria-label` on the bell.
- User menu trigger has focus ring; no “View profile” item.
- Theme toggle has aria-label.
- Dialogs (Radix) generally OK.
- No skip-to-content.
- Auth password fields lack `aria-invalid` on failure.
- Contrast: existing design tokens; do not restyle globally.

---

## 10. Performance concerns

- Multiple `useSession` listeners.
- `useAccess` × Sidebar × MobileNav × RouteGuard × UserMenu — queries are shared via React Query; **auth listeners are not**.
- `attachFirebaseAuth` may retry after missing token.
- FCM register on every AppShell mount (already swallowed).
- No Zustand store today — **do not add one** unless a UI-only need appears. Session belongs in one React context; Firestore stays in React Query.

---

## 11. PWA assessment (decision)

A full offline PWA is **not** appropriate in Phase 2 (Auth, Firestore, LiveKit, payments need network). Foundation only:

- Web app manifest + existing `favicon.png` as icon.
- No caching service worker for app shell (would stale-auth and confuse).

---

## 12. Exact Phase 2 implementation plan

1. Single `AuthProvider` session; wait for `authStateReady` in the auth attacher.
2. Dedicated `auth-errors.ts`; keep `toUserMessage` as the app-wide translator.
3. `useProfile` returns the real `users/{uid}` doc or `null` (no fake Member).
4. Derived account state: `incomplete | pending | active | suspended`.
5. `/onboarding` for missing profile (Google + interrupted signup). Cannot self-assign `superadmin`.
6. `_authenticated` redirect to `/auth?redirect=`; incomplete profile → `/onboarding`.
7. Force `getIdToken(true)` after `completeSignup`.
8. Superadmin dashboard + **narrow nav** (dashboard + settings).
9. User menu: settings, avatar image, verification hint.
10. Settings: avatar upload (`avatars/{uid}/…`), phone from profile, appearance (existing theme).
11. Server functions: approve/reject member (claims + `users.membership_status`); remind school (notify owner).
12. Notification bell loading/error; unread count.
13. Identity banners (pending teacher, unverified email) in the shell.
14. Skip link, larger mobile tabs, AppShell error boundary.
15. Manifest foundation.
16. Production `vite build`. No emulator E2E in this environment unless emulators are running.

**Out of scope (later phases):** AI Tutor depth, full classroom, exams, payments product, admissions product, deploying Cloud Functions (Spark).
