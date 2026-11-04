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

async function schoolIdForClass(classId: string): Promise<string | null> {
  const cls = await getById<{ school_id?: string | null }>(COLLECTIONS.classes, classId);
  return typeof cls?.school_id === "string" && cls.school_id ? cls.school_id : null;
}

export function useLiveSessions(classIds: string[]) {
  const qc = useQueryClient();
  const key = classIds.slice().sort().join(",");

  const query = useQuery({
    queryKey: ["live-sessions", key],
    enabled: classIds.length > 0,
    refetchInterval: 20_000,
    queryFn: async (): Promise<ClassroomSession[]> => {
      const schoolId = await schoolIdForClass(classIds[0]!);
      if (!schoolId) return [];
      // school_id must be in the query or Firestore rules reject the list.
      return findMany<ClassroomSession>(COLLECTIONS.classroomSessions, [
        where("school_id", "==", schoolId),
        where("class_id", "in", classIds.slice(0, 30)),
        where("is_active", "==", true),
      ]);
    },
  });

  useEffect(() => {
    if (!classIds.length) return;
    let unsub: (() => void) | undefined;
    void schoolIdForClass(classIds[0]!).then((schoolId) => {
      if (!schoolId) return;
      unsub = subscribeMany(
        COLLECTIONS.classroomSessions,
        [
          where("school_id", "==", schoolId),
          where("class_id", "in", classIds.slice(0, 30)),
          where("is_active", "==", true),
        ],
        () => qc.invalidateQueries({ queryKey: ["live-sessions", key] }),
      );
    });
    return () => unsub?.();
  }, [key, classIds, qc]);

  return query;
}

export function useActiveSession(classId?: string) {
  return useQuery({
    queryKey: ["classroom-session", classId],
    enabled: !!classId,
    queryFn: async (): Promise<ClassroomSession | null> => {
      const schoolId = await schoolIdForClass(classId!);
      if (!schoolId) return null;
      return findOne<ClassroomSession>(COLLECTIONS.classroomSessions, [
        where("school_id", "==", schoolId),
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
      const schoolId = await schoolIdForClass(classId!);
      if (!schoolId) return null;
      return findOne<ClassroomSession>(COLLECTIONS.classroomSessions, [
        where("school_id", "==", schoolId),
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

  let existing: ClassroomSession | undefined;
  try {
    const live = await findMany<ClassroomSession>(COLLECTIONS.classroomSessions, [
      where("school_id", "==", cls.school_id),
      where("class_id", "==", input.classId),
      where("is_active", "==", true),
    ]);
    existing = live.find((row) => row.status === "live" || row.is_active);
  } catch (error) {
    console.error("[live] existing-session lookup failed:", error);
  }
  if (existing) {
    // Rejoin must re-seed the host so the room never shows "Waiting for the teacher"
    // when the starter is already in the session.
    try {
      await seedHostParticipant({
        sessionId: existing.id,
        userId: input.hostId,
        schoolId: cls.school_id,
        isHost: existing.host_id === input.hostId,
      });
    } catch (error) {
      console.error("[live] host re-seed on existing session failed:", error);
    }
    return existing;
  }

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
        return session;
      } catch (error) {
        if (!looksLikeDirnameCrash(error)) {
          console.error("[live] server end failed:", error);
        }
      }
      const endedAt = nowIso();
      try {
        await patchById(COLLECTIONS.classroomSessions, session.id, {
          status: "ended",
          is_active: false,
          ended_at: endedAt,
        });
        if (session.school_id) {
          const rows = await findMany<{ id: string; left_at?: string | null }>(
            COLLECTIONS.classroomParticipants,
            [
              where("school_id", "==", session.school_id),
              where("session_id", "==", session.id),
            ],
          );
          await Promise.all(
            rows
              .filter((row) => !row.left_at)
              .map((row) =>
                patchById(COLLECTIONS.classroomParticipants, row.id, {
                  left_at: endedAt,
                  hand_raised: false,
                }),
              ),
          );
        }
      } catch (clientError) {
        throw classifyFirebase(clientError);
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
      const session = await getById<{ school_id?: string | null }>(
        COLLECTIONS.classroomSessions,
        sessionId!,
      );
      if (!session?.school_id) return [];
      const rows = await findMany<Omit<Participant, "profile">>(COLLECTIONS.classroomParticipants, [
        where("school_id", "==", session.school_id),
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
    let unsub: (() => void) | undefined;
    void getById<{ school_id?: string | null }>(COLLECTIONS.classroomSessions, sessionId).then(
      (session) => {
        if (!session?.school_id) return;
        unsub = subscribeMany(
          COLLECTIONS.classroomParticipants,
          [
            where("school_id", "==", session.school_id),
            where("session_id", "==", sessionId),
          ],
          () => qc.invalidateQueries({ queryKey: ["classroom-participants", sessionId] }),
        );
      },
    );
    return () => unsub?.();
  }, [sessionId, qc]);

  return query;
}

export function useJoinRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string; isHost: boolean }) => {
      const session = await getById<{
        school_id?: string | null;
        host_id?: string | null;
        is_active?: boolean;
      }>(COLLECTIONS.classroomSessions, input.sessionId);
      if (!session?.school_id) throw new Error("That live session was not found.");
      if (session.is_active === false) throw new Error("This session has ended.");

      // Prefer client seed — Admin join still trips ESM `__dirname` on Vercel.
      // Host flag must follow session.host_id, not generic staff role.
      const isHost = session.host_id === input.userId;
      try {
        await seedHostParticipant({
          sessionId: input.sessionId,
          userId: input.userId,
          schoolId: session.school_id,
          isHost,
        });
        return { id: participantDocId(input.sessionId, input.userId) };
      } catch (clientError) {
        console.error("[live] client join failed, trying server:", clientError);
      }
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
    mutationFn: async (input: string | { sessionId: string; userId: string }) => {
      const sessionId = typeof input === "string" ? input : input.sessionId;
      const userId =
        typeof input === "string"
          ? (await import("@/lib/firebase/client")).getFirebaseAuth().currentUser?.uid
          : input.userId;
      try {
        await reportLivePresence({ data: { sessionId } });
        return;
      } catch (error) {
        console.error("[live] server presence failed, using client:", error);
      }
      if (!userId) return;
      const id = participantDocId(sessionId, userId);
      const now = nowIso();
      try {
        const existing = await getById<{ connected_at?: string | null; rejoin_count?: number }>(
          COLLECTIONS.classroomParticipants,
          id,
        );
        if (!existing) return;
        await patchById(COLLECTIONS.classroomParticipants, id, {
          connected_at: existing.connected_at ?? now,
          last_connected_at: now,
          left_at: null,
          rejoin_count: (existing.rejoin_count ?? 0) + (existing.connected_at ? 1 : 0),
        });
      } catch (clientError) {
        console.error("[live] client presence patch failed:", clientError);
      }
    },
  });
}

export type ParticipantPatch = Partial<
  Pick<Participant, "hand_raised" | "mic_on" | "cam_on" | "camera_allowed" | "warned_at">
>;

async function schoolIdForSession(sessionId: string): Promise<string | null> {
  const session = await getById<{ school_id?: string | null }>(
    COLLECTIONS.classroomSessions,
    sessionId,
  );
  return typeof session?.school_id === "string" && session.school_id ? session.school_id : null;
}

export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string; patch: ParticipantPatch }) => {
      const selfKeys = new Set(["hand_raised", "mic_on", "cam_on"]);
      const keys = Object.keys(input.patch);
      const selfOnly = keys.every((k) => selfKeys.has(k));
      try {
        if (selfOnly) {
          const id = participantDocId(input.sessionId, input.userId);
          const existing = await getById(COLLECTIONS.classroomParticipants, id);
          if (!existing) return;
          await patchById(COLLECTIONS.classroomParticipants, id, input.patch);
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
        try {
          await moderateLiveParticipant({
            data: {
              sessionId: input.sessionId,
              targetUserId: input.userId,
              patch,
            },
          });
        } catch (error) {
          console.error("[live] server moderate failed, using client:", error);
          await patchById(
            COLLECTIONS.classroomParticipants,
            participantDocId(input.sessionId, input.userId),
            patch,
          );
        }
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
      try {
        await moderateLiveParticipant({
          data: {
            sessionId: input.sessionId,
            ...(input.exceptUserId ? { exceptUserId: input.exceptUserId } : {}),
            patch,
          },
        });
        return;
      } catch (error) {
        console.error("[live] server bulk moderate failed, using client:", error);
      }
      const schoolId = await schoolIdForSession(input.sessionId);
      if (!schoolId) throw new Error("That live session was not found.");
      const rows = await findMany<{ id: string; user_id: string; left_at?: string | null }>(
        COLLECTIONS.classroomParticipants,
        [where("school_id", "==", schoolId), where("session_id", "==", input.sessionId)],
      );
      await Promise.all(
        rows
          .filter(
            (row) =>
              !row.left_at &&
              row.user_id !== input.exceptUserId,
          )
          .map((row) => patchById(COLLECTIONS.classroomParticipants, row.id, patch)),
      );
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
      const schoolId = await schoolIdForSession(sessionId!);
      if (!schoolId) return [];
      const rows = await findMany<Omit<ClassroomMessage, "sender">>(COLLECTIONS.classroomMessages, [
        where("school_id", "==", schoolId),
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
    let unsub: (() => void) | undefined;
    void schoolIdForSession(sessionId).then((schoolId) => {
      if (!schoolId) return;
      unsub = subscribeMany(
        COLLECTIONS.classroomMessages,
        [where("school_id", "==", schoolId), where("session_id", "==", sessionId)],
        () => qc.invalidateQueries({ queryKey: ["classroom-chat", sessionId] }),
      );
    });
    return () => unsub?.();
  }, [sessionId, qc]);

  return query;
}

export function useSendClassroomMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; senderId: string; body: string }) => {
      try {
        await sendClassroomChat({ data: { sessionId: input.sessionId, body: input.body } });
        return;
      } catch (error) {
        console.error("[live] server chat failed, using client:", error);
      }
      const schoolId = await schoolIdForSession(input.sessionId);
      if (!schoolId) throw new Error("That live session was not found.");
      await createDoc(COLLECTIONS.classroomMessages, {
        session_id: input.sessionId,
        sender_id: input.senderId,
        body: input.body,
        school_id: schoolId,
        created_at: nowIso(),
      });
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
      const schoolId = await schoolIdForSession(sessionId!);
      if (!schoolId) return null;
      return findOne<{ connected_at?: string | null; left_at?: string | null }>(
        COLLECTIONS.classroomParticipants,
        [
          where("school_id", "==", schoolId),
          where("session_id", "==", sessionId!),
          where("user_id", "==", userId!),
        ],
      );
    },
  });
}
