import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COLLECTIONS,
  findMany,
  findOne,
  patchById,
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
import type { LiveSessionStatus } from "@/features/live-classroom/contracts";

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

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      hostId: string;
      title?: string;
      lessonId?: string | null;
    }) => {
      void input.hostId;
      try {
        return await startLiveSession({
          data: {
            classId: input.classId,
            lessonId: input.lessonId ?? null,
            ...(typeof input.title === "string" ? { title: input.title } : {}),
          },
        });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["classroom-session", s.class_id] });
      qc.invalidateQueries({ queryKey: ["live-sessions"] });
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
        throw classifyFirebase(error);
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
      void input.userId;
      void input.isHost;
      try {
        return await joinLiveSession({ data: { sessionId: input.sessionId } });
      } catch (error) {
        throw classifyFirebase(error);
      }
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
      void input.userId;
      try {
        await leaveLiveSession({ data: { sessionId: input.sessionId } });
      } catch (error) {
        throw classifyFirebase(error);
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
      } catch (error) {
        throw classifyFirebase(error);
      }
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
