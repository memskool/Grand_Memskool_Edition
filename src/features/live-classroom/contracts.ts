import { z } from "zod";

export const LIVE_SESSION_STATUSES = ["scheduled", "ready", "live", "ended", "cancelled"] as const;

export type LiveSessionStatus = (typeof LIVE_SESSION_STATUSES)[number];

export const ATTENDANCE_MARKS = ["present", "absent", "late", "excused"] as const;
export type LiveAttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export const StartLiveSessionSchema = z.object({
  classId: z.string().min(1),
  lessonId: z.string().min(1).nullable().optional(),
  title: z.string().trim().max(160).optional(),
});

export const SessionIdSchema = z.object({
  sessionId: z.string().min(1),
});

export const SendClassroomChatSchema = z.object({
  sessionId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

export const ModerateParticipantSchema = z.object({
  sessionId: z.string().min(1),
  targetUserId: z.string().min(1).optional(),
  exceptUserId: z.string().min(1).optional(),
  patch: z.object({
    mic_on: z.boolean().optional(),
    camera_allowed: z.boolean().optional(),
    cam_on: z.boolean().optional(),
    warned_at: z.string().min(1).nullable().optional(),
  }),
});

export const CorrectLiveAttendanceSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  status: z.enum(ATTENDANCE_MARKS),
  note: z.string().trim().max(500).optional(),
});

export type ClassroomToken = {
  token: string;
  serverUrl: string;
  identity: string;
  canPublish: boolean;
  canShareScreen: boolean;
};

export type LiveSessionRecord = {
  id: string;
  school_id: string | null;
  class_id: string;
  host_id: string;
  lesson_id: string | null;
  title: string | null;
  status: LiveSessionStatus;
  is_active: boolean;
  provider: "livekit";
  provider_room: string;
  started_at: string;
  ended_at: string | null;
  cancelled_at: string | null;
  attendance_finalized_at: string | null;
};

export function participantDocId(sessionId: string, userId: string) {
  return `${sessionId}_${userId}`;
}

export function providerRoomName(sessionId: string) {
  return `memskool-${sessionId}`;
}

export function sessionIdFromRoom(room?: string | null): string | null {
  if (!room?.startsWith("memskool-")) return null;
  const id = room.slice("memskool-".length).trim();
  return id.length > 0 ? id : null;
}
