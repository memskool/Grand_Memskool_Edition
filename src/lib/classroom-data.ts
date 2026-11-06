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
  finalizeSessionAttendance,
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

/** Ghost LIVE badges: teachers leave without End, leaving is_active forever. */
const LIVE_SESSION_MAX_MS = 4 * 60 * 60 * 1000;

export function isFreshLiveSession(
  session: Pick<ClassroomSession, "is_active" | "status" | "started_at">,
  now = Date.now(),
): boolean {
  if (!session.is_active) return false;
  const status = session.status ?? "live";
  if (status !== "live") return false;
  const started = Date.parse(session.started_at);
  if (Number.isNaN(started)) return false;
  return now - started <= LIVE_SESSION_MAX_MS;
}

/**
 * Phase 5 shared LIVE predicate: fresh + host participant still in the room.
 * Unknown host presence (`null`) is NOT enough — that produced false LIVE badges.
 */
export async function isLiveRoomOpen(session: ClassroomSession): Promise<boolean> {
  if (!isFreshLiveSession(session)) return false;
  return (await hostStillInRoom(session)) === true;
}

async function closeOpenParticipantsClient(
  session: Pick<ClassroomSession, "id" | "school_id">,
  leftAt: string,
) {
  if (!session.school_id) return;
  try {
    const rows = await findMany<{ id: string; left_at?: string | null }>(
      COLLECTIONS.classroomParticipants,
      [where("school_id", "==", session.school_id), where("session_id", "==", session.id)],
    );
    await Promise.all(
      rows
        .filter((row) => !row.left_at)
        .map((row) =>
          patchById(COLLECTIONS.classroomParticipants, row.id, {
            left_at: leftAt,
            hand_raised: false,
          }),
        ),
    );
  } catch (error) {
    console.error("[live] close participants failed:", error);
  }
}

async function endSessionDocClient(session: Pick<ClassroomSession, "id" | "school_id">) {
  const endedAt = nowIso();
  await patchById(COLLECTIONS.classroomSessions, session.id, {
    status: "ended",
    is_active: false,
    ended_at: endedAt,
  });
  await closeOpenParticipantsClient(session, endedAt);
}

/** true = host present, false = host gone, null = could not check (e.g. rules). */
async function hostStillInRoom(session: ClassroomSession): Promise<boolean | null> {
  try {
    const host = await getById<{ left_at?: string | null }>(
      COLLECTIONS.classroomParticipants,
      participantDocId(session.id, session.host_id),
    );
    if (!host) return false;
    return !host.left_at;
  } catch {
    return null;
  }
}

/**
 * LIVE means a fresh active session whose host is still in the room.
 * Orphan is_active rows (Leave without End) must not light the badge.
 */
async function healStaleLiveSessions(rows: ClassroomSession[]): Promise<ClassroomSession[]> {
  const keep: ClassroomSession[] = [];
  const close: ClassroomSession[] = [];

  await Promise.all(
    rows.map(async (row) => {
      if (await isLiveRoomOpen(row)) {
        keep.push(row);
        return;
      }
      if ((row.status ?? "live") === "live" && row.is_active) {
        close.push(row);
      }
    }),
  );

  if (close.length) {
    void Promise.all(
      close.map(async (row) => {
        try {
          await endSessionDocClient(row);
        } catch (error) {
          console.error("[live] stale session heal failed:", row.id, error);
        }
      }),
    );
  }
  return keep;
}

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

/** Phase 4: group class ids by school so multi-school teachers are not truncated to classIds[0]. */
async function classIdsBySchool(classIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  await Promise.all(
    classIds.map(async (classId) => {
      const schoolId = await schoolIdForClass(classId);
      if (!schoolId) return;
      const list = map.get(schoolId) ?? [];
      list.push(classId);
      map.set(schoolId, list);
    }),
  );
  return map;
}

export function useLiveSessions(classIds: string[]) {
  const qc = useQueryClient();
  const key = classIds.slice().sort().join(",");

  const query = useQuery({
    queryKey: ["live-sessions", key],
    enabled: classIds.length > 0,
    refetchInterval: 20_000,
    queryFn: async (): Promise<ClassroomSession[]> => {
      const bySchool = await classIdsBySchool(classIds);
      if (bySchool.size === 0) return [];
      const chunks = await Promise.all(
        [...bySchool.entries()].map(([schoolId, ids]) =>
          findMany<ClassroomSession>(COLLECTIONS.classroomSessions, [
            where("school_id", "==", schoolId),
            where("class_id", "in", ids.slice(0, 30)),
            where("is_active", "==", true),
          ]),
        ),
      );
      // Drop (and heal) ghost sessions left active after Leave without End.
      return healStaleLiveSessions(
        chunks.flat().filter((row) => (row.status ?? "live") === "live"),
      );
    },
  });

  useEffect(() => {
    if (!classIds.length) return;
    let unsubs: Array<() => void> = [];
    let cancelled = false;
    void classIdsBySchool(classIds).then((bySchool) => {
      if (cancelled) return;
      unsubs = [...bySchool.entries()].map(([schoolId, ids]) =>
        subscribeMany(
          COLLECTIONS.classroomSessions,
          [
            where("school_id", "==", schoolId),
            where("class_id", "in", ids.slice(0, 30)),
            where("is_active", "==", true),
          ],
          () => qc.invalidateQueries({ queryKey: ["live-sessions", key] }),
        ),
      );
    });
    return () => {
      cancelled = true;
      for (const unsub of unsubs) unsub();
    };
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
      const row = await findOne<ClassroomSession>(COLLECTIONS.classroomSessions, [
        where("school_id", "==", schoolId),
        where("class_id", "==", classId!),
        where("is_active", "==", true),
      ]);
      if (!row) return null;
      if (await isLiveRoomOpen(row)) return row;
      try {
        await endSessionDocClient(row);
      } catch (error) {
        console.error("[live] active session heal failed:", error);
      }
      return null;
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

/** Phase 3: client writes only when the server path itself is broken — never for authz denials. */
function isInfrastructureFailure(error: unknown): boolean {
  if (looksLikeDirnameCrash(error)) return true;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("function timeout")
  ) {
    return true;
  }
  if (
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("not allowed") ||
    message.includes("not approved")
  ) {
    return false;
  }
  return false;
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
    // Phase 5: is_host is immutable from the client after create.
    await patchById(COLLECTIONS.classroomParticipants, id, {
      left_at: null,
      last_joined_at: now,
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

  // Phase 5: client fallback must mirror server assignment checks.
  const owned = cls.teacher_id === input.hostId;
  if (!owned) {
    const assigned = await findMany<{ teacher_id: string; status?: string }>(
      COLLECTIONS.classTeacherAssignments,
      [
        where("class_id", "==", input.classId),
        where("teacher_id", "==", input.hostId),
        where("status", "==", "active"),
      ],
    ).catch(() => []);
    if (assigned.length === 0) {
      const { isSchoolManager } = await import("@/types/roles");
      const profile = await getById<{ role?: string }>(COLLECTIONS.users, input.hostId).catch(
        () => null,
      );
      const role = profile?.role === "admin" ? "institution" : profile?.role;
      if (!isSchoolManager(role as "institution" | "admin" | "superadmin" | undefined)) {
        throw new Error("You are not assigned to this class.");
      }
    }
  }

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
    const reusable = await isLiveRoomOpen(existing);
    if (!reusable) {
      try {
        await endSessionDocClient(existing);
      } catch (error) {
        console.error("[live] stale existing session end failed:", error);
      }
    } else {
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
      // Phase 3: server-required for live start; client only on infrastructure failure.
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
        if (!isInfrastructureFailure(error)) throw classifyFirebase(error);
        console.error("[live] server start infrastructure failure, client fallback:", error);
        return startSessionOnClient(input);
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
        if (!isInfrastructureFailure(error)) throw classifyFirebase(error);
        console.error("[live] server end infrastructure failure, client fallback:", error);
      }
      try {
        await endSessionDocClient(session);
      } catch (clientError) {
        throw classifyFirebase(clientError);
      }
      // Phase 6: never silently skip attendance finalize on infrastructure fallback.
      try {
        await finalizeSessionAttendance({ data: { sessionId: session.id } });
      } catch (finalizeError) {
        console.error("[live] attendance finalize after client end failed:", finalizeError);
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
        return session;
      } catch (error) {
        if (!isInfrastructureFailure(error)) throw classifyFirebase(error);
        console.error("[live] server cancel infrastructure failure, client fallback:", error);
      }
      try {
        const endedAt = nowIso();
        await patchById(COLLECTIONS.classroomSessions, session.id, {
          status: "cancelled",
          is_active: false,
          ended_at: endedAt,
          cancelled_at: endedAt,
        });
        await closeOpenParticipantsClient(session, endedAt);
      } catch (clientError) {
        throw classifyFirebase(clientError);
      }
      try {
        await finalizeSessionAttendance({ data: { sessionId: session.id } });
      } catch (finalizeError) {
        console.error("[live] attendance finalize after client cancel failed:", finalizeError);
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
          [where("school_id", "==", session.school_id), where("session_id", "==", sessionId)],
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

      // Phase 3: server-required join; host flag follows session.host_id on the server.
      try {
        return await joinLiveSession({ data: { sessionId: input.sessionId } });
      } catch (error) {
        if (!isInfrastructureFailure(error)) throw classifyFirebase(error);
        console.error("[live] server join infrastructure failure, client fallback:", error);
        const isHost = session.host_id === input.userId;
        await seedHostParticipant({
          sessionId: input.sessionId,
          userId: input.userId,
          schoolId: session.school_id,
          isHost,
        });
        return { id: participantDocId(input.sessionId, input.userId) };
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
        if (!isInfrastructureFailure(error)) throw classifyFirebase(error);
        console.error("[live] server leave infrastructure failure, client fallback:", error);
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
        if (!isInfrastructureFailure(error)) {
          console.error("[live] server presence failed:", error);
          return;
        }
        console.error("[live] server presence infrastructure failure, client fallback:", error);
      }
      // Phase 6: connected_at is server/webhook only — do not forge presence from the client.
      if (!userId) return;
      const id = participantDocId(sessionId, userId);
      try {
        const existing = await getById(COLLECTIONS.classroomParticipants, id);
        if (!existing) return;
        await patchById(COLLECTIONS.classroomParticipants, id, {
          left_at: null,
          last_joined_at: nowIso(),
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
          .filter((row) => !row.left_at && row.user_id !== input.exceptUserId)
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
      // Phase 8: Gold sessions use synthetic school_id (gold_*) — query by session_id.
      const schoolId = await schoolIdForSession(sessionId!);
      const rows = await findMany<Omit<ClassroomMessage, "sender">>(
        COLLECTIONS.classroomMessages,
        schoolId && !schoolId.startsWith("gold_")
          ? [
              where("school_id", "==", schoolId),
              where("session_id", "==", sessionId!),
              orderBy("created_at"),
            ]
          : [where("session_id", "==", sessionId!), orderBy("created_at")],
      );
      return Promise.all(
        rows.map((row) => attachNamedUser(row, row.sender_id, "sender")),
      ) as Promise<ClassroomMessage[]>;
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    let unsub: (() => void) | undefined;
    void schoolIdForSession(sessionId).then((schoolId) => {
      unsub = subscribeMany(
        COLLECTIONS.classroomMessages,
        schoolId && !schoolId.startsWith("gold_")
          ? [where("school_id", "==", schoolId), where("session_id", "==", sessionId)]
          : [where("session_id", "==", sessionId)],
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
      const schoolId = await schoolIdForSession(sessionId!);
      if (!schoolId) return [];
      const rows = await findMany<Omit<SessionAttendanceRow, "profile">>(COLLECTIONS.attendance, [
        where("school_id", "==", schoolId),
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
