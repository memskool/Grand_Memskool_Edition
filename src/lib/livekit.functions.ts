import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { providerRoomName, type ClassroomToken } from "@/features/live-classroom/contracts";
import { toClientJson } from "@/lib/firebase/plain-data";

export type { ClassroomToken };

type SessionFields = {
  school_id?: string | null;
  class_id?: string;
  host_id?: string;
  status?: string;
  is_active?: boolean;
  provider_room?: string | null;
  kind?: string | null;
};

/**
 * LiveKit token mint — no firebase-admin.
 * Auth: Firebase ID token verified with jose JWKS.
 * Session load: Firestore REST as the user (rules enforce access).
 * Phase 3: server helpers are dynamic-imported so client chunks stay Admin-free.
 */
export const issueClassroomToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<ClassroomToken> => {
    const request = getRequest();
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No authorization header provided");
    }
    const idToken = header.slice("Bearer ".length).trim();
    if (!idToken) throw new Error("Unauthorized: No token provided");

    const { verifyFirebaseIdTokenWithJose } =
      await import("@/lib/firebase/verify-id-token-jose.server");
    const { getFirestoreDocAsUser } = await import("@/lib/firebase/firestore-user-rest.server");
    const { mintLiveKitAccessToken } = await import("@/lib/livekit-token.server");

    const auth = await verifyFirebaseIdTokenWithJose(idToken);
    if (auth.role === "teacher" && !auth.approved) {
      throw new Error("Your school has not approved your teacher account yet.");
    }

    const serverUrl = process.env["LIVEKIT_URL"];
    const apiKey = process.env["LIVEKIT_API_KEY"];
    const apiSecret = process.env["LIVEKIT_API_SECRET"];
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new Error("Live video is not configured yet. Add the LiveKit credentials.");
    }

    const session = await getFirestoreDocAsUser<SessionFields>(
      COLLECTIONS.classroomSessions,
      data.sessionId,
      idToken,
    );
    if (!session) throw new Error("You are not allowed to join this class.");

    const status = session.status ?? (session.is_active ? "live" : "ended");
    if (status !== "live" || session.is_active === false) {
      throw new Error("This session has ended.");
    }

    const isHost = session.host_id === auth.userId;
    const sameSchool =
      !!auth.schoolId && !!session.school_id && auth.schoolId === session.school_id;
    const isStaff =
      auth.role === "teacher" ||
      auth.role === "admin" ||
      auth.role === "institution" ||
      auth.role === "superadmin";
    const isStudent = auth.role === "student";
    // Host always; same-school staff/students for live rooms.
    if (!isHost && !(sameSchool && (isStaff || isStudent))) {
      throw new Error("You are not allowed to join this class.");
    }

    const canPublish = true;
    const canShareScreen = isHost || isStaff;

    const profile = await getFirestoreDocAsUser<{ full_name?: string }>(
      COLLECTIONS.users,
      auth.userId,
      idToken,
    ).catch(() => null);

    const token = await mintLiveKitAccessToken({
      apiKey,
      apiSecret,
      identity: auth.userId,
      name: profile?.full_name || auth.email || "Memskool user",
      room: session.provider_room || providerRoomName(session.id),
      canPublish,
      canShareScreen,
      roomAdmin: isHost,
    });

    return toClientJson({
      token,
      serverUrl,
      identity: auth.userId,
      canPublish,
      canShareScreen,
    });
  });
