# Live classroom error handling

User-facing copy comes from `toMediaError` / `authErrorMessage`. Secrets and stack traces are not shown.

| Failure | What the user sees | Recovery |
| --- | --- | --- |
| Missing LiveKit env | “Live video is not configured yet…” | Admin adds `LIVEKIT_*` |
| Suspended | Cannot join | School lifts suspension |
| Unauthorized join / token | “You are not allowed to join this class.” | Correct enrollment |
| Ended / cancelled | Explicit ended or cancelled message | Materials / missed work |
| Camera/mic blocked | Permission message | Browser settings |
| No device | “No camera or microphone was found” | Use another device |
| Screen share on mobile / no `getDisplayMedia` | Unsupported; button disabled | Desktop browser |
| PiP unsupported | Unsupported message | Stay in tab |
| Connecting | “Joining the classroom…” | Wait |
| Reconnect | “Reconnecting…” | Automatic LiveKit retry |
| Disconnect | “Connection lost…” | Leave and rejoin |
| Chat send fail | Toast with safe message | Retry |
| Room create / start fail | Toast | Retry; check assignment |

Provider outage surfaces as a failed token or connect (`kind: unknown` or config). There is no fake “connected” state: `connected` is set only after `room.connect` succeeds.
