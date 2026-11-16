# Firebase architecture

Memskool’s system of record is **Cloud Firestore** (native mode, named database `default`, `africa-south1`, Enterprise). Firebase Data Connect was removed.

## Clients

| Surface | SDK | Notes |
| --- | --- | --- |
| Browser | `firebase` (Auth, Firestore, Storage, optional App Check / Analytics / FCM) | `src/lib/firebase/client.ts` |
| TanStack Start server functions | `firebase-admin` | `src/lib/firebase/admin.server.ts` |
| Cloud Functions | `firebase-admin` + Functions v2 | `functions/src/index.ts` — **not deployable on Spark** |

## Why TanStack server functions exist

Cloud Functions cannot be deployed until Blaze billing is on. Privileged work (custom claims, answer-key grading, LiveKit tokens, Flutterwave, announcement fan-out) therefore runs in TanStack Start with the Admin SDK. Cloud Functions are the long-term path for Firestore triggers and FCM.

## Auth model

- Email/password and Google via Firebase Auth.
- Custom claims (`role`, `schoolId`, `approved`) are written only by Admin SDK (`completeSignup` / `refreshUserClaims`).
- UI role `institution` is stored as claim `admin`.
- `superadmin` cannot be self-assigned at signup.

## Storage

One default bucket. Legacy bucket names (`locker-files`, `library-files`) map to object-path prefixes in `src/lib/storage.ts`. Rules live in `storage.rules`.

## Realtime

Postgres `postgres_changes` is replaced by Firestore `onSnapshot` (`subscribeMany` in `src/lib/firebase/repo.ts`) for classroom, chat, timetable, and notifications.

## Functions foundation (undeployed)

- `onNotificationCreated` — email/SMS delivery rows + FCM multicast
- `onDisciplinaryActionCreated` — audit log
- `refreshUserClaims` — callable: school managers re-sync student/teacher/parent claims for members of their own school; superadmin for any school/role (never assigns superadmin); audit-logged
- All functions target the named database `default` (triggers set `database: "default"`)
- `ping` — health

## Queries

Standard Firestore queries (not pipelines) so React Query, listeners, and the emulator stay aligned with the existing hook surface.
