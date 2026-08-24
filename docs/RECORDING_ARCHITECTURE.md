# Recording architecture

**Status: intentionally deferred.**

LiveKit Cloud supports egress (`EgressClient` is in `livekit-server-sdk`). Memskool does **not** start recordings, store media, or expose replay.

Lessons still have `recording_ref` (Phase 3 placeholder). It is not written by Phase 5.

When recordings are approved later, the intended flow is:

```
Authorized start → LiveKit egress → processing → metadata on the session/lesson
        ↓
Authorized access only (school + class + role)
        ↓
Retention policy
```

Do not treat the absence of recording as a Phase 5 blocker. Live teaching, chat, attendance, materials, and AI entry points work without it.
