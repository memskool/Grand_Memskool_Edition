import "@tanstack/react-start/server-only";

/**
 * Mint a LiveKit access token with `jose` only.
 * Avoids `livekit-server-sdk` in the ESM server bundle (it and its CJS deps
 * trip `__dirname is not defined` when Nitro bundles them).
 */
export async function mintLiveKitAccessToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name: string;
  room: string;
  canPublish: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  roomAdmin?: boolean;
  canShareScreen?: boolean;
  ttlSeconds?: number;
}): Promise<string> {
  const { SignJWT } = await import("jose");
  const canPublishSources = input.canPublish
    ? input.canShareScreen
      ? ["camera", "microphone", "screen_share", "screen_share_audio"]
      : ["camera", "microphone"]
    : [];

  const video: Record<string, unknown> = {
    roomJoin: true,
    room: input.room,
    canPublish: input.canPublish,
    canSubscribe: input.canSubscribe !== false,
    canPublishData: input.canPublishData !== false,
  };
  if (input.roomAdmin) video["roomAdmin"] = true;
  if (canPublishSources.length) video["canPublishSources"] = canPublishSources;

  const secret = new TextEncoder().encode(input.apiSecret);
  const ttl = input.ttlSeconds ?? 60 * 60 * 2;
  return new SignJWT({ video, name: input.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(input.apiKey)
    .setSubject(input.identity)
    .setNotBefore(0)
    .setExpirationTime(`${ttl}s`)
    .sign(secret);
}

/**
 * Tear down the LiveKit room when a session ends or is cancelled, so every participant is
 * disconnected at once instead of lingering in a dead room. Uses LiveKit's Twirp REST API
 * directly (no `livekit-server-sdk` in the bundle). Best-effort: callers never block on it.
 */
export async function deleteLiveKitRoom(input: {
  apiKey: string;
  apiSecret: string;
  serverUrl: string;
  room: string;
}): Promise<boolean> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(input.apiSecret);
  const token = await new SignJWT({ video: { roomCreate: true, room: input.room } })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(input.apiKey)
    .setSubject("memskool-server")
    .setNotBefore(0)
    .setExpirationTime("60s")
    .sign(secret);
  const base = input.serverUrl
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:")
    .replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`${base}/twirp/livekit.RoomService/DeleteRoom`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room: input.room }),
      signal: controller.signal,
    });
    // 404 = already gone (room emptied on its own) — that is success for our purposes.
    return res.ok || res.status === 404;
  } finally {
    clearTimeout(timeout);
  }
}
