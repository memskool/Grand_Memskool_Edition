# Phase 1 migration notes

## Source of truth

Postgres tables became Firestore collections with the same snake_case names. `profiles` / `user_roles` collapsed into `users/{uid}` plus Auth custom claims.

## Client data layer

`src/lib/*-data.ts` hooks keep the same exports. Internals use `@/lib/firebase/repo` (`findMany`, `createDoc`, `subscribeMany`, …). Nested Supabase selects (`subject:subjects(...)`) are hydrated in follow-up reads.

## Storage

`uploadWithProgress` uses `uploadBytesResumable`. Callers still pass legacy bucket names; paths are rewritten in `storageObjectPath`.

## RPCs replaced

| Postgres / RPC | Replacement |
| --- | --- |
| `submit_assessment` | `submitAssessment` server function + `assessment_answer_keys` |
| `owner_assessment_questions` | `ownerAssessmentQuestions` |
| `is_suspended` | Admin query on `disciplinary_actions` |
| `has_role` / `teaches_class` | Auth claims + class `teacher_id` |
| Realtime channels | Firestore `onSnapshot` |

## Server functions

`requireSupabaseAuth` → `requireFirebaseAuth`. Admin reads/writes go through `src/lib/firebase/admin-repo.ts`.

## Still in the repo (on purpose)

`src/integrations/supabase/*` and `@supabase/supabase-js` remain until emulator validation. No `src/` feature code imports them.

## IDs

Firestore auto-ids are not UUIDs. Server validators that used `z.string().uuid()` now use `z.string().min(1)`.
