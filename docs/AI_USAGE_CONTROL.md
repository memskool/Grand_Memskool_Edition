# AI usage control

Server-side only.

- Rate: 40 requests / 5 minutes / user via Firestore transaction on `ai_rate_limits/{uid}`.
- Ledger: `ai_usage/{uid}_{date}` increments requests, failures, latency sum.
- No client counters.
- No product-defined paid quota yet; the ledger is the foundation for school allocations later.
