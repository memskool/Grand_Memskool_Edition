# Phase 7 audit — production hardening

**Date:** 2026-08-22  
**Method:** Phase 1–6 reports, full `firestore.rules` / `storage.rules` review, client write inventory, server-function inventory, query/listener scan, secret scan, payment/AI/classroom/assessment paths.

This is a **reviewed production candidate**, not a claim that every browser and device was lab-tested.

---

## 1. Critical

| ID | Issue | Evidence |
| --- | --- | --- |
| C1 | Client can create `orders` with `status: "paid"` | `firestore.rules` orders create only checks `buyer_id` |
| C2 | Any signed-in user can read/write all `conversations` / `messages` | Rules `isAuthenticated()` with no membership |
| C3 | Parent can self-create `parent_students` for any `student_id` | Unlocks `listLinkedChildResults` |

## 2. High

| ID | Issue |
| --- | --- |
| H1 | `school_applications` update: any school admin, no `sameSchool` |
| H2 | `locker_items` update: owner can change `school_id` / arbitrary fields |
| H3 | `marketplace_items` not school-scoped |
| H4 | Students can self-create `reward_events` with arbitrary points |
| H5 | `useSchoolOverview` loads every readable `users` document |
| H6 | `useWeeklyTimetable` listens to **all** `timetable_slots` |
| H7 | Messaging queries unbounded; N+1 hydrate |
| H8 | `flushNotifications` can be invoked by any signed-in user (fan-out storm) |
| H9 | `useReconcileOrder` never wired after Flutterwave return |

## 3. Medium

| ID | Issue |
| --- | --- |
| M1 | Storage: no MIME checks; recordings have no size cap; avatars readable by any user |
| M2 | `submissions` student update can set arbitrary `status` |
| M3 | `school_members` create does not prove the school exists |
| M4 | `mapFirebaseMessage` can return raw `error.message` |
| M5 | Several toasts show `e.message` |
| M6 | `robots.txt` allows crawling of authenticated app paths |
| M7 | `.gitignore` only lists `.env`, not `.env.local` / `.env.production` |
| M8 | Assessment/marketplace lists lack `limit()` |
| M9 | Same-school `users` read exposes email/phone to classmates |
| M10 | Duplicate privileged paths (client enroll + server enroll) |

## 4. Low

Unused LiveKit component packages; unused Supabase client; Data Connect stubs; `useCreateSchool` blocked by rules; no emulator rules tests; no E2E; App Check not enforced; Spark blocks Cloud Functions; CSP not set (would risk LiveKit/Firebase).

## 5. Security (summary)

Roles come from **custom claims** (`request.auth.token`), not client `role` fields. Assessment keys, private scores, classroom sessions/messages, payment events, and AI writes are already Admin-only. The remaining holes are messaging, orders, parent links, rewards, and a few tenant-admin checks.

## 6–13. Performance, architecture, UX, a11y, mobile, integrity, cost, deploy

See later Phase 7 docs. Main cost risks: unbounded user scan, whole-collection timetable listener, unbounded chat, N+1 assessment hydrates. Architecture is still TanStack Start + Firestore + Admin SDK (not Next.js). Mobile/a11y were not device-lab tested. Deploy still needs human rules/index deploy and secret env.

## 14–19. Tests, incomplete, debt, dead code, deps

Automated coverage is thin (assessment marking unit tests only). Incomplete: recordings, AI marking, Blaze functions, App Check enforce. Debt: dual client/server academic writes, leftover Supabase/Lovable email routes. Deps: `@supabase/supabase-js`, `@livekit/components-*`, Data Connect generated packages unused by product routes.
