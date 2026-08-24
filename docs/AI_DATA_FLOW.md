# AI data flow

Sent to Crane5: system instructions, authorized context pack, last 12 messages, current user text. Not sent: API keys to the client, other students’ data, full locker files, raw tokens.

Stored in Memskool: conversation metadata, messages on success, optional memory notes, daily usage counters, rate-limit window.

Temporary: `users/{uid}/ai-uploads/**` is allowed in Storage for future vision; no automatic purge (Spark has no cron). Do not upload unless vision is enabled.

Logs: capability, intent, latency, success — not message bodies.
