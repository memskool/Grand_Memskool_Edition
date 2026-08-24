# Video provider integration

**Provider:** LiveKit (already in the repo and `.env.example`). Daily.co is not present and was not adopted.

## Env

```
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Optional webhook: `https://<app-origin>/api/public/webhooks/livekit` using the same API key/secret.

## Client

`livekit-client` via `useLiveKit`: connect, mic, camera, screen share (`setScreenShareEnabled`), Picture-in-Picture, remote attach, reconnect events.

`@livekit/components-react` is still a dependency but the room UI is custom Memskool chrome, not the stock LiveKit prebuilt.

## Server

`livekit-server-sdk` `AccessToken` + `TrackSource` grants. Room name is always `memskool-{sessionId}` stored on the session as `provider_room`.

## Capabilities used

Camera, microphone, subscribe, data publish, host admin grant, screen share (host; desktop `getDisplayMedia`), reconnect signals.

## Not wired

Egress / recording, live captions, LiveKit Cloud dashboard UI, participant hard-kick via RoomService (mute is Firestore + local `forceMute`).
