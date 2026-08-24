# Phase 4 completion report

**Date:** 2026-08-22  
**Project:** `memskool-4e193`  
**Mandate:** Memskool Intelligence (Crane5). Phase 5 not started.

## Before Phase 4

`/ai-tutor` was an iframe of crane5.com plus clipboard prompt kits. Learning-memory insights used the Lovable Gemini gateway on the server. No conversation store, no educational context injection, no AI usage controls.

## Audited

Phase 1–3 docs, `ai-tutor.tsx`, `learning-memory.functions.ts`, Firestore rules, Functions sample, `.env.example`, and the live Crane5 site. Crane5 is the proprietary tutor; it has **no published HTTP API** (`/api/v1/chat` 404).

## How Crane5 was integrated

A Memskool AI gateway (`src/features/ai-tutor/`) sits between the client and Crane5. The browser never holds Crane5 keys. `callCrane5` POSTs OpenAI-compatible chat completions to `CRANE5_API_URL` with `CRANE5_API_KEY`. Until those env vars are set, tutoring returns a clear configuration error. It does **not** fall back to Lovable/Gemini for chat.

## Operational vs pending credentials

**In the product now:** authz, contracts, context assembly, conversations, memory, usage/rate limits, Memskool chat UI, Ask-AI from assignments/lessons/missed work, browser voice-in and speech-out, exam UI lock.

**Needs Crane5 API from Altrastate:** live generations.

## Context the gateway can load (when authorized)

Subject, curriculum topic, lesson (enrollment), assignment (+ `ai_policy`, default explanation-only), missed work (owner), learning profile, short memory notes. Client ids are re-fetched server-side.

## Conversations and memory

Owner-only `ai_conversations` / `ai_messages`. Failed replies are not stored. `ai_learning_memory` is separate from chat history.

## Security

JWT + role checks; school isolation on context; owner-only rules; Admin SDK writes; no VITE secrets.

## Usage / abuse

Firestore transaction: 40 requests / 5 minutes / user. Daily `ai_usage` counters. Oversized messages rejected at 8000 chars.

## Tests actually run

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| Phase 4 ESLint (new AI files) | Pass |
| `npm run build` | Pass |
| Emulator / live Crane5 / device lab / rules tests | **Not run** |

## Deferred

Crane5 OCR API, true streaming until Crane5 SSE exists, vector search, SSO into Crane5 accounts, server exam lock, automatic upload purge, Functions deploy, parent tutor.

## Human actions

1. Provision Crane5 HTTP tutor API.
2. Set `CRANE5_API_URL`, `CRANE5_API_KEY` (optional `CRANE5_MODEL`, `CRANE5_VISION`) on the server.
3. Deploy rules/indexes: `firebase deploy --only firestore:rules,firestore:indexes,storage`
4. Same Phase 1 blockers (Blaze, `.env` Firebase, etc.).
