# Phase 1 completion report

**Date:** 2026-08-22  
**Project:** `memskool-4e193`  
**Mandate:** Backend reconstruction onto Firebase. Frontend preserved. Phase 2 not started.

## Done

- Architecture audit: `docs/PHASE_1_AUDIT.md`
- Firebase client, Admin SDK, typed models, error helper, auth service, custom claims signup
- Firestore + Storage rules (prototype, default-deny, school isolation, answer keys split)
- Compound indexes in `firestore.indexes.json`
- Frontend data layer and server functions moved off Supabase (hooks keep the same names)
- Assessment grading and LiveKit / payments / announcements use Admin SDK
- Cloud Functions foundation in `functions/src/index.ts` (FCM, audit, claims refresh)
- FCM token registration helper (no-op without VAPID key)
- Docs listed in this folder

## Not done / blocked

| Item | Reason |
| --- | --- |
| Cloud Functions deploy | Spark billing — enable Blaze |
| App Hosting | Spark + not in scope for this cut |
| Emulator test suite | Not executed in this pass |
| `firebase deploy --only firestore:rules,storage,auth` | Needs explicit review/deploy |
| Remove `@supabase/supabase-js` | Left until rules + auth are validated on emulators |
| App Check enforcement | No reCAPTCHA site key in env yet |
| Storage bucket confirmation | Create/verify in console |
| Google OAuth authorized domains | Confirm `localhost` in console |
| `gcloud auth application-default login` | Human login in a new terminal |

## Honesty checks

- Tests were **not** run against emulators in this session.
- Functions were **not** deployed.
- Open production rules must not remain; deploy the new `firestore.rules` after review.
- `school_directory` public read is intentional for School-ID lookup.

## How to verify next

1. Fill `.env` from `.env.example` (see `docs/ENVIRONMENT_SETUP.md`).
2. `firebase emulators:start`
3. `VITE_USE_FIREBASE_EMULATORS=true npm run dev`
4. Sign up as student / teacher / institution; confirm claims and school isolation.
5. After Blaze: deploy functions and wire FCM.
