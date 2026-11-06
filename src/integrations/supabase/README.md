# Quarantined — not used by Memskool runtime

These Lovable/Supabase stubs remain for historical preview tooling only.

- **Do not import** `@/integrations/supabase/*` from app routes, server functions, or bootstrap (`src/start.ts`, `src/router`, auth).
- Memskool identity and data use **Firebase Auth + Firestore** (Phases 1–4).
- Safe to delete in a later cleanup once Lovable no longer references the folder.
