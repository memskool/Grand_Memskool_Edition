# AI error handling

User-facing examples actually used:

- Crane5 not configured: “The tutor is not configured yet…”
- Timeout / 5xx / empty: “The tutor is taking longer than expected. Please try again.”
- 429: same slower-retry copy
- 402: credits exhausted
- Rate limit: wait a few minutes
- Unauthorized context: permission copy
- OCR disabled / vision off: capability-specific copy

Failed turns are not stored as completed assistant messages. Network failures surface via the existing error mapper.
