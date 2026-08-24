# Analytics and events

Firebase Analytics is initialized in the browser when `isSupported()` and a measurement ID exist (`src/lib/firebase/client.ts`). Events are sent through `trackProductEvent` in `src/lib/analytics.ts`.

If `VITE_FIREBASE_MEASUREMENT_ID` is empty, nothing is sent.

## Events that fire

| Event | Purpose | Trigger | Data | Privacy |
| --- | --- | --- | --- | --- |
| `workspace_open` | Session volume | Authenticated shell mounts | none | No PII |
| `assessment_submitted` | Completion of an attempt | `useSubmitAttempt` success | `outcome=success` | No scores, prompts, or IDs |
| `classroom_join` | Live join success | `useJoinRoom` success | `outcome=success` | No session or user IDs |

Optional `role` may be attached later; it is not sent today.

## What we do not track

Lesson text, AI transcripts, answers, emails, names, school IDs, payment payloads, or full error stacks.

## Automatic Google signals

Firebase / GA4 may still collect standard technical signals (device, session). Keep measurement IDs off if a school forbids analytics.

## Product value

These events answer: are people opening the workspace, finishing assessments, and joining live class? They are not a full funnel. Signup completion is visible in Firebase Auth, not a custom event.
