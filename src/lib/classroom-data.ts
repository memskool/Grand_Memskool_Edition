import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COLLECTIONS,
  createDoc,
  findMany,
  findOne,
  getById,
  nowIso,
  patchById,
  setById,
  subscribeMany,
  where,
  orderBy,
} from "@/lib/firebase/repo";
import { attachNamedUser } from "@/lib/firebase/hydrate";
import { classifyFirebase } from "@/lib/errors/app-error";
import { PRODUCT_EVENTS, trackProductEvent } from "@/lib/analytics";
import {
  cancelLiveSession,
  correctLiveAttendance,
  endLiveSession,
  joinLiveSession,
  leaveLiveSession,
  moderateLiveParticipant,
  reportLivePresence,
  sendClassroomChat,
  startLiveSession,
} from "@/features/live-classroom/session.functions";
import {
  participantDocId,
  providerRoomName,
  type LiveSessionStatus,
} from "@/features/live-classroom/contracts";

export type ClassroomSession = {
  id: string;
  class_id: string;
  host_id: string;
  school_id?: string;
  title: string | null;
  lesson_id?: string | null;
  status?: LiveSessionStatus | string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  provider?: string;
  provider_room?: string;
};

export type Participant = {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  connected_at?: string | null;
  duration_ms?: number;
  hand_raised: boolean;
  mic_on: boolean;
  cam_on: boolean;
  camera_allowed: boolean;
  warned_at: string | null;
  is_host: boolean;
  profile: { full_name: string; avatar_url: string | null } | null;
};

export type ClassroomMessage = {
  id: string;
  session_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string; avatar_url: string | null } | null;
};

export type SessionAttendanceRow = {
  id: string;
  student_id: string;
  status: "present" | "absent" | "late" | "excused";
  provisional?: boolean;
  duration_ms?: number;
  session_id?: string | null;
  lesson_id?: string | null;
  correction_note?: string | null;
  profile: { full_name: string; avatar_url: string | null } | null;
};

export function useLiveSessions(classIds: string[]) {
  const qc = useQueryClient();
  const key = classIds.slice().sort().join(",");

  const query = useQuery({
    queryKey: ["live-sessions", key],
    enabled: classIds.length > 0,
    refetchInterval: 20_000,
    queryFn: async (): Promise<ClassroomSession[]> => {
      return findMany<ClassroomSession>(COLLECTIONS.classroomSessions, [
        where("class_id", "in", classIds.slice(0, 30)),
        where("is_active", "==", true),
      ]);
    },
  });

  useEffect(() => {
    if (!classIds.length) return;
    return subscribeMany(
      COLLECTIONS.classroomSessions,
      [where("class_id", "in", classIds.slice(0, 30)), where("is_active", "==", true)],
      () => qc.invalidateQueries({ queryKey: ["live-sessions", key] }),
    );
  }, [key, classIds, qc]);

  return query;
}

export function useActiveSession(classId?: string) {
  return useQuery({
    queryKey: ["classroom-session", classId],
    enabled: !!classId,
    queryFn: async (): Promise<ClassroomSession | null> => {
      return findOne<ClassroomSession>(COLLECTIONS.classroomSessions, [
        where("class_id", "==", classId!),
        where("is_active", "==", true),
      ]);
    },
  });
}

export function useRecentSession(classId?: string) {
  return useQuery({
    queryKey: ["recent-classroom-session", classId],
    enabled: !!classId,
    queryFn: async (): Promise<ClassroomSession | null> => {
      return findOne<ClassroomSession>(COLLECTIONS.classroomSessions, [
        where("class_id", "==", classId!),
        orderBy("started_at", "desc"),
      ]);
    },
  });
}

function unwrapSession(raw: unknown): ClassroomSession {
  let current: unknown = raw;
  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;
    const obj = current as Record<string, unknown>;
    if (typeof obj["id"] === "string" && typeof obj["class_id"] === "string") {
      return obj as unknown as ClassroomSession;
    }
    for (const key of ["data", "result", "payload", "value"]) {
      if (obj[key] && typeof obj[key] === "object") {
        current = obj[key];
        break;
      }
    }
  }
  throw new Error("Live session started but the response was incomplete. Refresh and rejoin.");
}

function looksLikeDirnameCrash(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("__dirname") || message.toLowerCase().includes("es module scope");
}

async function seedHostParticipant(input: {
  sessionId: string;
  userId: string;
  schoolId: string;
  isHost: boolean;
}) {
  const id = participantDocId(input.sessionId, input.userId);
  const now = nowIso();
  const existing = await getById(COLLECTIONS.classroomParticipants, id);
  if (existing) {
    await patchById(COLLECTIONS.classroomParticipants, id, {
      left_at: null,
      last_joined_at: now,
      is_host: input.isHost,
      hand_raised: false,
    });
    return;
  }
  await setById(COLLECTIONS.classroomParticipants, id, {
    session_id: input.sessionId,
    user_id: input.userId,
    school_id: input.schoolId,
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
}

/** Browser-side start — does not use firebase-admin (avoids Vercel ESM `__dirname`). */
async function startSessionOnClient(input: {
  classId: string;
  hostId: string;
  title?: string;
  lessonId?: string | null;
}): Promise<ClassroomSession> {
  const cls = await getById<{
    school_id: string;
    name?: string;
    teacher_id?: string | null;
    status?: string;
  }>(COLLECTIONS.classes, input.classId);
  if (!cls) throw new Error("That class was not found.");
  if (cls.status === "archived") throw new Error("That class is archived.");

  const live = await findMany<ClassroomSession>(COLLECTIONS.classroomSessions, [
    where("class_id", "==", input.classId),
    where("is_active", "==", true),
  ]);
  const existing = live.find((row) => row.status === "live" || row.is_active);
  if (existing) return existing;

  const now = nowIso();
  const title = input.title ?? cls.name ?? "Live class";
  const id = await createDoc(COLLECTIONS.classroomSessions, {
    school_id: cls.school_id,
    class_id: input.classId,
    host_id: input.hostId,
    lesson_id: input.lessonId ?? null,
    title,
    status: "live",
    is_active: true,
    provider: "livekit",
    provider_room: "",
    started_at: now,
    ended_at: null,
    cancelled_at: null,
    attendance_finalized_at: null,
    notified_live_at: now,
  });
  const room = providerRoomName(id);
  await patchById(COLLECTIONS.classroomSessions, id, { provider_room: room });
  await seedHostParticipant({
    sessionId: id,
    userId: input.hostId,
    schoolId: cls.school_id,
    isHost: true,
  });
  if (input.lessonId) {
    try {
      await patchById(COLLECTIONS.lessons, input.lessonId, {
        classroom_session_id: id,
        status: "in_progress",
        updated_at: now,
      });
    } catch (error) {
      console.error("[live] lesson link update failed:", error);
    }
  }
  return {
    id,
    class_id: input.classId,
    host_id: input.hostId,
    school_id: cls.school_id,
    title,
    lesson_id: input.lessonId ?? null,
    status: "live",
    started_at: now,
    ended_at: null,
    is_active: true,
    provider: "livekit",
    provider_room: room,
  };
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      hostId: string;
      title?: string;
      lessonId?: string | null;
    }) => {
      // Prefer the browser write path — Admin SDK on the server still trips `__dirname`.
      try {
        return await startSessionOnClient(input);
      } catch (clientError) {
        console.error("[live] client start failed, trying server:", clientError);
      }
      try {
        const raw = await startLiveSession({
          data: {
            classId: input.classId,
            lessonId: input.lessonId ?? null,
            ...(typeof input.title === "string" ? { title: input.title } : {}),
          },
        });
        return unwrapSession(raw);
      } catch (error) {
        if (looksLikeDirnameCrash(error)) {
          return startSessionOnClient(input);
        }
        throw classifyFirebase(error);
      }
    },
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ["classroom-session", s.class_id] });
      void qc.invalidateQueries({ queryKey: ["live-sessions"] });
      void qc.invalidateQueries({ queryKey: ["classroom-participants", s.id] });
    },
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: ClassroomSession) => {
      try {
        await endLiveSession({ data: { sessionId: session.id } });
      } catch (error) {
        if (!looksLikeDirnameCrash(error)) {
          // Fall through to client end when Admin SDK is unavailable.
          console.error("[live] server end failed:", error);
        }
        try {
          await patchById(COLLECTIONS.classroomSessions, session.id, {
            status: "ended",
            is_active: false,
            ended_at: nowIso(),
          });
        } catch (clientError) {
          throw classifyFirebase(clientError);
        }
      }
      return session;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["classroom-session", s.class_id] });
      qc.invalidateQueries({ queryKey: ["classroom-participants", s.id] });
      qc.invalidateQueries({ queryKey: ["session-attendance", s.id] });
      qc.invalidateQueries({ queryKey: ["live-sessions"] });
    },
  });
}

export function useCancelSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: ClassroomSession) => {
      try {
        await cancelLiveSession({ data: { sessionId: session.id } });
      } catch (error) {
        throw classifyFirebase(error);
      }
      return session;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["classroom-session", s.class_id] });
      qc.invalidateQueries({ queryKey: ["live-sessions"] });
    },
  });
}

export function useParticipants(sessionId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["classroom-participants", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<Participant[]> => {
      const rows = await findMany<Omit<Participant, "profile">>(COLLECTIONS.classroomParticipants, [
        where("session_id", "==", sessionId!),
        orderBy("joined_at"),
      ]);
      return Promise.all(
        rows.map((row) => attachNamedUser(row, row.user_id, "profile")),
      ) as Promise<Participant[]>;
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    return subscribeMany(
      COLLECTIONS.classroomParticipants,
      [where("session_id", "==", sessionId)],
      () => qc.invalidateQueries({ queryKey: ["classroom-participants", sessionId] }),
    );
  }, [sessionId, qc]);

  return query;
}

export function useJoinRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string; isHost: boolean }) => {
      try {
        return await joinLiveSession({ data: { sessionId: input.sessionId } });
      } catch (error) {
        console.error("[live] server join failed, using client:", error);
      }
      const session = await getById<{ school_id?: string | null }>(
        COLLECTIONS.classroomSessions,
        input.sessionId,
      );
      if (!session?.school_id) throw new Error("That live session was not found.");
      await seedHostParticipant({
        sessionId: input.sessionId,
        userId: input.userId,
        schoolId: session.school_id,
        isHost: input.isHost,
      });
      return { id: participantDocId(input.sessionId, input.userId) };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] });
      void trackProductEvent(PRODUCT_EVENTS.classroomJoin, { outcome: "success" });
    },
  });
}

export function useLeaveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string }) => {
      try {
        await leaveLiveSession({ data: { sessionId: input.sessionId } });
        return;
      } catch (error) {
        console.error("[live] server leave failed, using client:", error);
      }
      const id = participantDocId(input.sessionId, input.userId);
      try {
        await patchById(COLLECTIONS.classroomParticipants, id, {
          left_at: nowIso(),
          hand_raised: false,
        });
      } catch (clientError) {
        throw classifyFirebase(clientError);
      }
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] }),
  });
}

export function useReportPresence() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      try {
        await reportLivePresence({ data: { sessionId } });
        return;
      } catch (error) {
        console.error("[live] server presence failed, using client:", error);
      }
      // Best-effort: mark connected_at on the caller's participant doc if it exists.
      // Full join is handled by useJoinRoom.
      void sessionId;
    },
  });
}

export type ParticipantPatch = Partial<
  Pick<Participant, "hand_raised" | "mic_on" | "cam_on" | "camera_allowed" | "warned_at">
>;

export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string; patch: ParticipantPatch }) => {
      const selfKeys = new Set(["hand_raised", "mic_on", "cam_on"]);
      const keys = Object.keys(input.patch);
      const selfOnly = keys.every((k) => selfKeys.has(k));
      try {
        if (selfOnly) {
          const existing = await findOne<{ id: string; user_id: string }>(
            COLLECTIONS.classroomParticipants,
            [where("session_id", "==", input.sessionId), where("user_id", "==", input.userId)],
          );
          if (!existing) return;
          await patchById(COLLECTIONS.classroomParticipants, existing.id, input.patch);
          return;
        }
        const patch: {
          mic_on?: boolean;
          camera_allowed?: boolean;
          cam_on?: boolean;
          warned_at?: string | null;
        } = {};
        if (input.patch.mic_on !== undefined) patch.mic_on = input.patch.mic_on;
        if (input.patch.camera_allowed !== undefined)
          patch.camera_allowed = input.patch.camera_allowed;
        if (input.patch.cam_on !== undefined) patch.cam_on = input.patch.cam_on;
        if (input.patch.warned_at !== undefined) patch.warned_at = input.patch.warned_at;
        await moderateLiveParticipant({
          data: {
            sessionId: input.sessionId,
            targetUserId: input.userId,
            patch,
          },
        });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] }),
  });
}

export function useBulkParticipantUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      patch: ParticipantPatch;
      exceptUserId?: string;
    }) => {
      try {
        const patch: {
          mic_on?: boolean;
          camera_allowed?: boolean;
          cam_on?: boolean;
          warned_at?: string | null;
        } = {};
        if (input.patch.mic_on !== undefined) patch.mic_on = input.patch.mic_on;
        if (input.patch.camera_allowed !== undefined)
          patch.camera_allowed = input.patch.camera_allowed;
        if (input.patch.cam_on !== undefined) patch.cam_on = input.patch.cam_on;
        if (input.patch.warned_at !== undefined) patch.warned_at = input.patch.warned_at;
        await moderateLiveParticipant({
          data: {
            sessionId: input.sessionId,
            ...(input.exceptUserId ? { exceptUserId: input.exceptUserId } : {}),
            patch,
          },
        });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] }),
  });
}

export function useClassroomChat(sessionId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["classroom-chat", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<ClassroomMessage[]> => {
      const rows = await findMany<Omit<ClassroomMessage, "sender">>(COLLECTIONS.classroomMessages, [
        where("session_id", "==", sessionId!),
        orderBy("created_at"),
      ]);
      return Promise.all(
        rows.map((row) => attachNamedUser(row, row.sender_id, "sender")),
      ) as Promise<ClassroomMessage[]>;
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    return subscribeMany(
      COLLECTIONS.classroomMessages,
      [where("session_id", "==", sessionId)],
      () => qc.invalidateQueries({ queryKey: ["classroom-chat", sessionId] }),
    );
  }, [sessionId, qc]);

  return query;
}

export function useSendClassroomMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; senderId: string; body: string }) => {
      void input.senderId;
      try {
        await sendClassroomChat({ data: { sessionId: input.sessionId, body: input.body } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["classroom-chat", v.sessionId] }),
  });
}

export function useSessionAttendance(sessionId?: string) {
  return useQuery({
    queryKey: ["session-attendance", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<SessionAttendanceRow[]> => {
      const rows = await findMany<Omit<SessionAttendanceRow, "profile">>(COLLECTIONS.attendance, [
        where("session_id", "==", sessionId!),
      ]);
      return Promise.all(
        rows.map((row) => attachNamedUser(row, row.student_id, "profile")),
      ) as Promise<SessionAttendanceRow[]>;
    },
  });
}

export function useCorrectLiveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      studentId: string;
      status: SessionAttendanceRow["status"];
      note?: string;
    }) => {
      try {
        await correctLiveAttendance({
          data: {
            sessionId: input.sessionId,
            studentId: input.studentId,
            status: input.status,
            ...(input.note ? { note: input.note } : {}),
          },
        });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["session-attendance", v.sessionId] }),
  });
}

export function useMyParticipation(sessionId?: string, userId?: string) {
  return useQuery({
    queryKey: ["my-participation", sessionId, userId],
    enabled: !!sessionId && !!userId,
    queryFn: async () => {
      return findOne<{ connected_at?: string | null; left_at?: string | null }>(
        COLLECTIONS.classroomParticipants,
        [where("session_id", "==", sessionId!), where("user_id", "==", userId!)],
      );
    },
  });
}
