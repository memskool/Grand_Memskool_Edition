# Phase 4 audit — Memskool Intelligence

**Date:** 2026-08-22  
**Method:** Phase 1–3 docs were read, then `src/`, `firestore.rules`, `functions/`, `.env.example`, and the live Crane5 site were inspected. The codebase is the source of truth.

---

## 1. What already exists

| Surface | Location | Reality |
| --- | --- | --- |
| AI Tutor page | `src/routes/_authenticated/ai-tutor.tsx` | Iframe of `https://crane5.com` plus copy-to-clipboard prompt toolkit |
| Learning memory | `learning-memory.functions.ts` | Server function; Lovable AI gateway (`google/gemini-2.5-flash`) writes `learning_profiles` + `ai_insights` |
| Insight cards | `AiInsightPanel` | Reads stored insights; refresh is explicit |
| Exam lock | `exam-mode.ts` | Client `sessionStorage` hides `/ai-tutor` during an exam |
| Genkit sample | `functions/src/genkit-sample.ts` | Unused Vertex/Gemini sample; Functions cannot deploy on Spark |
| Firebase AI Logic | not in app code | Skill exists; not wired |

**Proprietary AI:** Crane5 (Altrastate). Public product at `crane5.com` / `crane5.com/chat`. NCDC-oriented tutor, notes library, mentions photo of handwritten work. **No documented HTTP API** (`/api/v1/chat` returns 404). Chat requires Crane5 account sign-in inside the iframe — Memskool auth is not passed through.

---

## 2. What is functional

- Authenticated students (and stored `admin` role) can open `/ai-tutor`.
- Prompt builder prepends tutor mode + weak topics from `learning_profiles`.
- Dashboard insight refresh works **if** `LOVABLE_API_KEY` is set on the server.
- Exam mode hides the nav item and page (client-only).

---

## 3. What is mocked / incomplete

- The iframe is **not** a Memskool-controlled tutor. Context is not injected; users paste prompts.
- No conversation storage in Firestore.
- No lesson / assignment / missed-work context retrieval.
- No AI gateway, usage ledger, or rate limit.
- OCR/voice in the UI are Crane5 website features, not Memskool integrations.
- Teacher nav does not include AI Tutor.

---

## 4. What is insecure

- Iframe loads a third-party origin with microphone/camera permission — no Memskool authz.
- Client exam lock is not a server control.
- `LOVABLE_API_KEY` is server-only (good) but used only for insights, not tutoring.
- No school isolation on Crane5 chats (those chats live on Crane5 accounts).

---

## 5. What should be preserved

- Crane5 as the tutoring engine (do not replace with Gemini/Lovable chat).
- Learning-memory / insight cards (separate from tutoring).
- Exam-mode UI lock.
- Server-function + Admin SDK pattern (Spark cannot deploy Cloud Functions).
- Existing design system and `/ai-tutor` route.

---

## 6. What should be refactored

- Replace iframe+clipboard with a Memskool chat that calls a **server gateway**.
- Centralize Crane5 HTTP in one adapter (`CRANE5_API_URL` + `CRANE5_API_KEY`).
- Keep Lovable out of tutoring.

---

## 7. Integration points Crane5 exposes (verified)

| Capability | Evidence | Phase 4 decision |
| --- | --- | --- |
| Website chat | `crane5.com/chat` | Not used as the product UI |
| HTTP tutor API | **Not published** | Adapter with OpenAI-compatible chat completions; URL/key from env |
| Streaming | Unknown | Stream route if the adapter receives SSE; otherwise one complete reply (no fake typing) |
| OCR / vision | Website copy only | Capability registered; send image parts only if the adapter accepts them |
| Voice | Website `allow=microphone` | Browser Speech Recognition → text → gateway (no extra vendor) |
| TTS | Unknown | Browser `speechSynthesis` on explicit tap |

Until Altrastate provisions `CRANE5_API_URL` + `CRANE5_API_KEY`, the gateway returns a clear configuration error. It must **not** silently call Lovable/Gemini for tutoring.

---

## 8. Capabilities actually available today

Operational in Memskool after this phase **depends on Crane5 credentials**. Architecture, authz, context, conversations, memory, usage, and UI can be complete. Live Crane5 generations require the human-provided API.

---

## 9. What needs backend infrastructure

All tutoring: auth, school isolation, context assembly, Crane5 call, usage, rate limits. Use TanStack Start server functions + Admin SDK (same as Phase 1–3). Optional `/api/ai/tutor-stream` for streaming. Cloud Functions / Cloud Run **not** required and still blocked on Spark.

---

## 10. Deferred

- Semantic / vector retrieval (not required; send short authorized excerpts).
- Automated 24h purge of AI uploads (no cron worker on Spark).
- Server-side exam lock (exam state is still client session).
- Direct Crane5 account SSO.
- Full anti-cheat.
- Parent AI experience.
- Cloud Functions deploy.

## Implementation plan

Gateway in `src/features/ai-tutor/`. Collections: `ai_conversations`, `ai_messages`, `ai_learning_memory`, `ai_usage`, `ai_rate_limits`. Owner-only Firestore rules. Connect `/ai-tutor`, plus Ask-AI entry from lesson / assignment / missed work.
