# AI architecture

Memskool does not call Crane5 from the browser.

Client → authenticated server function (`sendTutorTurn`) → authz → rate limit → context assembly → Crane5 HTTP adapter → validated reply → Firestore messages + usage.

The adapter lives in `src/features/ai-tutor/crane5.ts`. Secrets: `CRANE5_API_URL`, `CRANE5_API_KEY` (server env only).

Dashboard insight refresh still uses `LOVABLE_API_KEY` and is not the tutor.

Streaming is **not** faked. Crane5’s public site has no documented stream API; replies are complete JSON. A stream path can be added in the adapter when Crane5 exposes SSE.
