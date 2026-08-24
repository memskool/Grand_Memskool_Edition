# AI memory

**Conversation history:** last 12 complete turns in the current thread.

**Learning memory:** `ai_learning_memory` notes (`struggle`, `goal`, `summary`, `preference`, `topic`) the user can save or delete.

**Academic records:** classes, lessons, assignments (Phase 3) — retrieved only when the request references them.

**Dashboard profile:** `learning_profiles` from insight refresh — weak/strong topics, style.

These are not merged into one blob. The gateway sends a short relevant subset only.
