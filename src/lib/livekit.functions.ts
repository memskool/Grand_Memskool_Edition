import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClassroomToken = {
  token: string;
  serverUrl: string;
  identity: string;
  canPublish: boolean;
};

/**
 * Mints a short-lived LiveKit access token. Room membership, host rights and
 * suspension are all decided here on the server — the browser cannot grant
 * itself publish rights or join a class it is not enrolled in.
 */
export const issueClassroomToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ClassroomToken> => {
    const { supabase, userId } = context;

    const serverUrl = process.env["LIVEKIT_URL"];
    const apiKey = process.env["LIVEKIT_API_KEY"];
    const apiSecret = process.env["LIVEKIT_API_SECRET"];
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new Error("Live video is not configured yet. Add the LiveKit credentials.");
    }

    const { data: suspended } = await supabase.rpc("is_suspended", { _user_id: userId });
    if (suspended) throw new Error("Your account is suspended and cannot join live classes.");

    // RLS on classroom_sessions already restricts this read to the host and
    // enrolled learners, so a missing row means "not authorised".
    const { data: session } = await supabase
      .from("classroom_sessions")
      .select("id, class_id, host_id, is_active")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("You are not allowed to join this class.");
    if (!session.is_active) throw new Error("This session has ended.");

    const isHost = session.host_id === userId;

    // Teacher-enforced device state decides publish rights for learners.
    const { data: participant } = await supabase
      .from("classroom_participants")
      .select("camera_allowed, mic_on")
      .eq("session_id", session.id)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const { AccessToken } = await import("livekit-server-sdk");
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: profile?.full_name || "Memskool user",
      ttl: "2h",
    });
    at.addGrant({
      room: `memskool-${session.id}`,
      roomJoin: true,
      canPublish: isHost || participant?.camera_allowed !== false,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
    });

    return {
      token: await at.toJwt(),
      serverUrl,
      identity: userId,
      canPublish: isHost || participant?.camera_allowed !== false,
    };
  });
