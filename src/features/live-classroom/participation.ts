import { adminGetById, adminSet, adminUpdate, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { participantDocId } from "./contracts";
import type { SessionDoc } from "./authz";

type ParticipantDoc = {
  session_id: string;
  user_id: string;
  school_id: string;
  is_host: boolean;
  joined_at: string;
  last_joined_at?: string;
  left_at: string | null;
  connected_at: string | null;
  last_connected_at?: string | null;
  duration_ms: number;
  rejoin_count: number;
  hand_raised: boolean;
  mic_on: boolean;
  cam_on: boolean;
  camera_allowed: boolean;
  warned_at: string | null;
};

function elapsedMs(from: string | null | undefined, untilIso: string): number {
  if (!from) return 0;
  const start = Date.parse(from);
  const end = Date.parse(untilIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return end - start;
}

export async function upsertParticipantJoin(input: {
  session: SessionDoc & { id: string };
  userId: string;
  isHost: boolean;
}): Promise<{ id: string }> {
  const id = participantDocId(input.session.id, input.userId);
  const now = new Date().toISOString();
  const existing = await adminGetById<ParticipantDoc>(COLLECTIONS.classroomParticipants, id);
  if (existing) {
    const rejoin = existing.left_at
      ? (existing.rejoin_count ?? 0) + 1
      : (existing.rejoin_count ?? 0);
    await adminUpdate(COLLECTIONS.classroomParticipants, id, {
      is_host: input.isHost,
      left_at: null,
      last_joined_at: now,
      rejoin_count: rejoin,
      hand_raised: false,
    });
    return { id };
  }
  await adminSet(COLLECTIONS.classroomParticipants, id, {
    session_id: input.session.id,
    user_id: input.userId,
    school_id: input.session.school_id,
    is_host: input.isHost,
    joined_at: now,
    last_joined_at: now,
    left_at: null,
    connected_at: null,
    last_connected_at: null,
    duration_ms: 0,
    rejoin_count: 0,
    hand_raised: false,
    mic_on: false,
    cam_on: false,
    camera_allowed: true,
    warned_at: null,
  });
  return { id };
}

export async function markParticipantConnected(sessionId: string, userId: string): Promise<void> {
  const id = participantDocId(sessionId, userId);
  const existing = await adminGetById<ParticipantDoc>(COLLECTIONS.classroomParticipants, id);
  if (!existing) return;
  const now = new Date().toISOString();
  await adminUpdate(COLLECTIONS.classroomParticipants, id, {
    connected_at: existing.connected_at ?? now,
    last_connected_at: now,
    left_at: null,
  });
}

export async function markParticipantLeft(sessionId: string, userId: string): Promise<void> {
  const id = participantDocId(sessionId, userId);
  const existing = await adminGetById<ParticipantDoc>(COLLECTIONS.classroomParticipants, id);
  if (!existing || existing.left_at) return;
  const now = new Date().toISOString();
  const extra = elapsedMs(existing.last_connected_at ?? existing.connected_at, now);
  await adminUpdate(COLLECTIONS.classroomParticipants, id, {
    left_at: now,
    last_connected_at: null,
    duration_ms: (existing.duration_ms ?? 0) + extra,
    hand_raised: false,
    mic_on: false,
    cam_on: false,
  });
}

export async function closeOpenParticipants(sessionId: string): Promise<void> {
  const rows = await adminWhere<ParticipantDoc>(
    COLLECTIONS.classroomParticipants,
    "session_id",
    "==",
    sessionId,
  );
  await Promise.all(
    rows.filter((row) => !row.left_at).map((row) => markParticipantLeft(sessionId, row.user_id)),
  );
}
