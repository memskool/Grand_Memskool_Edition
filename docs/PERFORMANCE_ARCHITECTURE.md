# Performance architecture

Stack is **TanStack Start + Vite**, not Next.js. There are no React Server Components to lean on. Performance work is query bounds, listener scope, and avoiding N+1 where cheap.

## Firestore

| Change | Why |
| --- | --- |
| School overview counts + 400-user cap | Stop loading every readable user |
| Timetable listener filtered by `school_id` | Stop listening to the whole collection |
| Messages last 80 | Bounded chat |
| Marketplace 40, orders 40, teacher assessments 40 | List bounds |
| Question bank 40 (Phase 6) | Already bounded |

Assessment hydrates still N+1 per attempt (get assessment doc). Acceptable at class size; a denormalised title on the attempt would be a later optimisation.

## Frontend

Heavy LiveKit, Recharts, and exam code stay on their routes (Vite code-splitting). Do not claim LCP numbers; they were not measured in a lab.

## AI

Phase 4 gateway already caps history and rate-limits. No extra “send the whole textbook” path was found.
