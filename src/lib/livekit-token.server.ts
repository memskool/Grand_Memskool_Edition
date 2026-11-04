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
