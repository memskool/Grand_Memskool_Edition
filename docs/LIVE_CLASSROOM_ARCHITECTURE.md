# Live classroom architecture

Memskool owns the **academic session**. LiveKit owns the **media room**.

```
Teacher (authorized class / lesson)
        ↓
startLiveSession (TanStack server fn + Admin SDK)
        ↓
classroom_sessions document (status=live)
        ↓
provider_room = memskool-{sessionId}
        ↓
issueClassroomToken (LiveKit JWT, secrets server-only)
        ↓
Browser connects with livekit-client
        ↓
joinLiveSession + reportLivePresence
        ↓
Chat / materials / Ask AI (Phase 4 gateway)
        ↓
endLiveSession → attendance + missed-work follow-up path
```

## Layers

| Layer | Location |
| --- | --- |
| UI | `virtual-classroom.tsx`, `ClassroomRoom.tsx` |
| Client hooks | `src/lib/classroom-data.ts`, `src/hooks/useLiveKit.ts` |
| Domain / authz | `src/features/live-classroom/` |
| Privileged APIs | `session.functions.ts`, `livekit.functions.ts` |
| Provider | LiveKit Cloud or self-hosted (`LIVEKIT_*` env) |
| Persistence | Firestore `classroom_*`, `attendance`, `notifications` |

Daily.co is **not** used. Phase 1 already selected LiveKit.

## What is not in the UI

Business rules for start, join, leave, chat, attendance, and tokens live in server functions. Components call hooks; they do not mint rooms or hold API secrets.
