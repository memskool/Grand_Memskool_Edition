import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { providerRoomName, type ClassroomToken } from "@/features/live-classroom/contracts";
import { participantDocId } from "@/features/live-classroom/contracts";
import type { SessionDoc } from "@/features/live-classroom/authz";

export type { ClassroomToken };

export const issueClassroomToken = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }): Promise<ClassroomToken> => {
    const { userId } = context;
    const { adminGetById, adminIsSuspended } = await import("@/lib/firebase/admin-repo");
    const { assertCanJoinSession } = await import("@/features/live-classroom/authz");

    const serverUrl = process.env["LIVEKIT_URL"];
    const apiKey = process.env["LIVEKIT_API_KEY"];
    const apiSecret = process.env["LIVEKIT_API_SECRET"];
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new Error("Live video is not configured yet. Add the LiveKit credentials.");
    }

    if (await adminIsSuspended(userId)) {
      throw new Error("Your account is suspended and cannot join live classes.");
    }

    const session = await adminGetById<SessionDoc>(COLLECTIONS.classroomSessions, data.sessionId);
    if (!session) throw new Error("You are not allowed to join this class.");

    const access = await assertCanJoinSession(context.role, context.schoolId, userId, session);

    const participant = await adminGetById<{ camera_allowed?: boolean }>(
      COLLECTIONS.classroomParticipants,
      participantDocId(session.id, userId),
    );

    const canPublish = access.isHost || participant?.camera_allowed !== false;
    const canShareScreen = access.isHost;

    const profile = await adminGetById<{ full_name: string }>(COLLECTIONS.users, userId);

    const { AccessToken, TrackSource } = await import("livekit-server-sdk");
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: profile?.full_name || "Memskool user",
      ttl: "2h",
    });
    at.addGrant({
      room: session.provider_room || providerRoomName(session.id),
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: access.isHost,
      canPublishSources: canShareScreen
        ? [
            TrackSource.CAMERA,
            TrackSource.MICROPHONE,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
          ]
        : [TrackSource.CAMERA, TrackSource.MICROPHONE],
    });

    return {
      token: await at.toJwt(),
      serverUrl,
      identity: userId,
      canPublish,
      canShareScreen,
    };
  });
