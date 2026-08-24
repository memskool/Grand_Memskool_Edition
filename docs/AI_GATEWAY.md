# AI gateway

Entry: `src/features/ai-tutor/gateway.functions.ts` (TanStack Start + `requireFirebaseAuth`).

Steps: verify JWT and role (student / teacher / approved teacher / admin) → Firestore sliding-window rate limit (40 / 5 min / user) → Zod `TutorTurnSchema` → `assembleContext` (ignores client school ids) → last 12 messages → modular instructions → `callCrane5` → persist user+assistant only on success → `ai_usage` increment → JSON log `{src,ok,capability,intent,latency_ms,context_type}` with no prompt or PII.

Cloud Functions / Cloud Run are not used (Spark still blocks Functions).
