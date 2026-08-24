# Real-time architecture

| Concern | System | Why |
| --- | --- | --- |
| Camera, mic, screen, subscribe, reconnect | LiveKit | Media SFU; not Firestore |
| Session live/ended list | Firestore query + 20s refetch + snapshot | Low frequency |
| Participant roster / hand / mute flags | Firestore snapshots | Educational state, not per-frame |
| Classroom chat | Firestore snapshots | Ordered, authorized, persisted |
| Presence for attendance | Server write on connect + optional webhook | Meaningful event |
| Token | Server function, once per connect | Avoid repeat minting |

## Intentionally not persisted

- Speaking indicators (LiveKit `isSpeaking` only).
- Per-second connection quality.
- Transient UI (chat draft, side-panel open).

## Listeners

`useLiveSessions`, `useParticipants`, and `useClassroomChat` each have one snapshot per key. They invalidate React Query rather than writing.

Do not add a Firestore write on every `RoomEvent`.
