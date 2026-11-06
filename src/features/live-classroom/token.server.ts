import "@/lib/node-esm-globals";
import "@tanstack/react-start/server-only";
import type { z } from "zod";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import { adminGetById, adminIsSuspended } from "@/lib/firebase/admin-repo";
import { toClientJson } from "@/lib/firebase/plain-data";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { isSchoolManager } from "@/types/roles";
import { providerRoomName, SessionIdSchema, type ClassroomToken } from "./contracts";
import { assertCanJoinSession, type SessionDoc } from "./authz";

type Args<T> = { data: T; context: AuthedContext };

/**
 * Phase 6: mint LiveKit tokens with the same join authz as Firestore
 * (enrollment / Gold / assignment), plus suspension + publish policy.
 */
export async function issueClassroomTokenHandler({
  data,
  context,
}: Args<z.infer<typeof SessionIdSchema>>): Promise<ClassroomToken> {
  if (context.role === "teacher" && !context.approved) {
    throw new Error("Your school has not approved your teacher account yet.");
  }
  if (await adminIsSuspended(context.userId)) {
    throw new Error("Your account is suspended and cannot join live classes.");
  }

  const serverUrl = process.env["LIVEKIT_URL"];
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  if (!serverUrl || !apiKey || !apiSecret) {
    throw new Error("Live video is not configured yet. Add the LiveKit credentials.");
  }

  const session = await adminGetById<SessionDoc>(COLLECTIONS.classroomSessions, data.sessionId);
  if (!session) throw new Error("You are not allowed to join this class.");

  const access = await assertCanJoinSession(
    context.role,
    context.schoolId,
    context.userId,
    session,
  );

  // Screen share: host or school managers only (not every same-school teacher).
  const canShareScreen =
    access.isHost || isSchoolManager(context.role) || context.role === "superadmin";
  const canPublish = access.canPublish;

  const profile = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, context.userId);
  const { mintLiveKitAccessToken } = await import("@/lib/livekit-token.server");
  const token = await mintLiveKitAccessToken({
    apiKey,
    apiSecret,
    identity: context.userId,
    name: profile?.full_name || context.email || "Memskool user",
    room: session.provider_room || providerRoomName(session.id),
    canPublish,
    canShareScreen,
    roomAdmin: access.isHost,
  });

  return toClientJson({
    token,
    serverUrl,
    identity: context.userId,
    canPublish,
    canShareScreen,
  });
}
