import "@tanstack/react-start/server-only";
import type { z } from "zod";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import {
  adminCreate,
  adminGetById,
  adminIsSuspended,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import {
  CorrectLiveAttendanceSchema,
  ModerateParticipantSchema,
  SendClassroomChatSchema,
  SessionIdSchema,
  StartLiveSessionSchema,
  type LiveSessionRecord,
  participantDocId,
  providerRoomName,
} from "./contracts";
import {
  assertCanHostClass,
  assertCanJoinSession,
  assertCanManageSession,
  type SessionDoc,
} from "./authz";
import {
  closeOpenParticipants,
  markParticipantConnected,
  markParticipantLeft,
  upsertParticipantJoin,
} from "./participation";
import { finalizeLiveAttendance } from "./attendance";

function asRecord(session: SessionDoc & { id: string }): LiveSessionRecord {
  const status =
    (session.status as LiveSessionRecord["status"] | undefined) ??
    (session.is_active ? "live" : "ended");
  return {
    id: session.id,
    school_id: session.school_id,
    class_id: session.class_id,
    host_id: session.host_id,
    lesson_id: session.lesson_id ?? null,
    title: session.title ?? null,
    status,
    is_active: session.is_active !== false && status === "live",
    provider: "livekit",
    provider_room: session.provider_room ?? providerRoomName(session.id),
    started_at: session.started_at ?? new Date().toISOString(),
    ended_at: session.ended_at ?? null,
    cancelled_at: null,
    attendance_finalized_at: null,
  };
}

async function loadSession(sessionId: string): Promise<SessionDoc & { id: string }> {
  const session = await adminGetById<SessionDoc>(COLLECTIONS.classroomSessions, sessionId);
  if (!session) throw new Error("You are not allowed to join this class.");
  return session;
}

async function notifyClass(input: {
  classId: string;
  schoolId: string;
  title: string;
  body: string;
  skipUserId?: string;
  kind: string;
}) {
  const enrollments = await adminWhere<{ student_id: string; status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    input.classId,
  );
  const ids = [
    ...new Set(
      enrollments
        .filter((row) => row.status !== "ended" && row.student_id !== input.skipUserId)
        .map((row) => row.student_id),
    ),
  ].slice(0, 80);
  const now = new Date().toISOString();
  const { createAndQueueNotification, dispatchNotifications } = await import(
    "@/lib/notifications.server"
  );
  await Promise.all(
    ids.map((userId) =>
      createAndQueueNotification({
        userId,
        title: input.title,
        body: input.body,
        kind: input.kind,
        link: "/virtual-classroom",
        schoolId: input.schoolId,
        createdAt: now,
      }),
    ),
  );
  void dispatchNotifications();
}

type Args<T> = { data: T; context: AuthedContext };

export async function startLiveSessionHandler({
  data,
  context,
}: Args<z.infer<typeof StartLiveSessionSchema>>): Promise<LiveSessionRecord> {
  if (context.role === "teacher" && !context.approved) {
    throw new Error("Your school has not approved your teacher account yet.");
  }
  const cls = await assertCanHostClass(context.role, context.schoolId, context.userId, data.classId);

  const live = await adminWhere<SessionDoc>(
    COLLECTIONS.classroomSessions,
    "class_id",
    "==",
    data.classId,
    [["is_active", "==", true]],
  );
  const existing = live[0];
  if (existing) return asRecord({ ...existing, id: existing.id });

  let lessonTitle: string | null = null;
  if (data.lessonId) {
    const lesson = await adminGetById<{
      school_id: string;
      class_id: string;
      title?: string;
      status?: string;
    }>(COLLECTIONS.lessons, data.lessonId);
    if (!lesson || lesson.school_id !== cls.school_id || lesson.class_id !== data.classId) {
      throw new Error("That lesson is not part of this class.");
    }
    lessonTitle = lesson.title ?? null;
  }

  const now = new Date().toISOString();
  const id = await adminCreate(COLLECTIONS.classroomSessions, {
    school_id: cls.school_id,
    class_id: data.classId,
    host_id: context.userId,
    lesson_id: data.lessonId ?? null,
    title: data.title ?? lessonTitle ?? cls.name ?? "Live class",
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
  await adminUpdate(COLLECTIONS.classroomSessions, id, { provider_room: room });

  if (data.lessonId) {
    await adminUpdate(COLLECTIONS.lessons, data.lessonId, {
      classroom_session_id: id,
      status: "in_progress",
      updated_at: now,
    });
  }

  await notifyClass({
    classId: data.classId,
    schoolId: cls.school_id,
    title: "Your class is live",
    body: `${data.title ?? lessonTitle ?? cls.name ?? "A class"} has started. Join from Virtual Classroom.`,
    skipUserId: context.userId,
    kind: "live_class",
  });

  return asRecord({
    id,
    school_id: cls.school_id,
    class_id: data.classId,
    host_id: context.userId,
    lesson_id: data.lessonId ?? null,
    title: data.title ?? lessonTitle ?? cls.name ?? "Live class",
    status: "live",
    is_active: true,
    provider_room: room,
    started_at: now,
    ended_at: null,
  });
}

export async function endLiveSessionHandler({
  data,
  context,
}: Args<z.infer<typeof SessionIdSchema>>) {
  const session = await loadSession(data.sessionId);
  await assertCanManageSession(context.role, context.schoolId, context.userId, session);
  if (session.status === "ended" || session.is_active === false) {
    return { ok: true as const, alreadyEnded: true };
  }
  const now = new Date().toISOString();
  await closeOpenParticipants(session.id);
  const attendance = await finalizeLiveAttendance({ session, recordedBy: context.userId });
  await adminUpdate(COLLECTIONS.classroomSessions, session.id, {
    status: "ended",
    is_active: false,
    ended_at: now,
    attendance_finalized_at: now,
  });
  if (session.lesson_id) {
    await adminUpdate(COLLECTIONS.lessons, session.lesson_id, {
      status: "completed",
      updated_at: now,
    });
  }

  const enrollments = await adminWhere<{ student_id: string; status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    session.class_id,
  );
  const participants = await adminWhere<{ user_id: string; connected_at?: string | null }>(
    COLLECTIONS.classroomParticipants,
    "session_id",
    "==",
    session.id,
  );
  const present = new Set(participants.filter((row) => row.connected_at).map((row) => row.user_id));
  const absentees = enrollments
    .filter((row) => row.status !== "ended" && !present.has(row.student_id))
    .map((row) => row.student_id)
    .slice(0, 80);
  const { createAndQueueNotification, dispatchNotifications } = await import(
    "@/lib/notifications.server"
  );
  await Promise.all(
    absentees.map((userId) =>
      createAndQueueNotification({
        userId,
        title: "You missed a live class",
        body: "Open Missed Work to see follow-up tasks your teacher assigns for this lesson.",
        kind: "live_class",
        link: "/missed-work",
        schoolId: session.school_id,
        createdAt: now,
      }),
    ),
  );
  void dispatchNotifications();

  return { ok: true as const, alreadyEnded: false, attendance };
}

export async function cancelLiveSessionHandler({
  data,
  context,
}: Args<z.infer<typeof SessionIdSchema>>) {
  const session = await loadSession(data.sessionId);
  await assertCanManageSession(context.role, context.schoolId, context.userId, session);
  if (session.status === "ended") throw new Error("This session has already ended.");
  if (session.status === "cancelled") return { ok: true as const };
  const now = new Date().toISOString();
  await closeOpenParticipants(session.id);
  await adminUpdate(COLLECTIONS.classroomSessions, session.id, {
    status: "cancelled",
    is_active: false,
    ended_at: now,
    cancelled_at: now,
  });
  if (session.lesson_id) {
    await adminUpdate(COLLECTIONS.lessons, session.lesson_id, {
      classroom_session_id: null,
      status: "scheduled",
      updated_at: now,
    });
  }
  await notifyClass({
    classId: session.class_id,
    schoolId: session.school_id,
    title: "Live class cancelled",
    body: `${session.title ?? "A live class"} was cancelled.`,
    skipUserId: context.userId,
    kind: "live_class",
  });
  return { ok: true as const };
}

export async function joinLiveSessionHandler({
  data,
  context,
}: Args<z.infer<typeof SessionIdSchema>>) {
  if (await adminIsSuspended(context.userId)) {
    throw new Error("Your account is suspended and cannot join live classes.");
  }
  const session = await loadSession(data.sessionId);
  const access = await assertCanJoinSession(
    context.role,
    context.schoolId,
    context.userId,
    session,
  );
  return upsertParticipantJoin({
    session,
    userId: context.userId,
    isHost: access.isHost,
  });
}

export async function leaveLiveSessionHandler({
  data,
  context,
}: Args<z.infer<typeof SessionIdSchema>>) {
  await markParticipantLeft(data.sessionId, context.userId);
  return { ok: true as const };
}

export async function reportLivePresenceHandler({
  data,
  context,
}: Args<z.infer<typeof SessionIdSchema>>) {
  const session = await loadSession(data.sessionId);
  await assertCanJoinSession(context.role, context.schoolId, context.userId, session);
  const id = participantDocId(session.id, context.userId);
  const existing = await adminGetById(COLLECTIONS.classroomParticipants, id);
  if (!existing) {
    await upsertParticipantJoin({
      session,
      userId: context.userId,
      isHost: session.host_id === context.userId,
    });
  }
  await markParticipantConnected(session.id, context.userId);
  return { ok: true as const };
}

export async function sendClassroomChatHandler({
  data,
  context,
}: Args<z.infer<typeof SendClassroomChatSchema>>) {
  const session = await loadSession(data.sessionId);
  await assertCanJoinSession(context.role, context.schoolId, context.userId, session);
  const participant = await adminGetById(
    COLLECTIONS.classroomParticipants,
    participantDocId(session.id, context.userId),
  );
  if (!participant && session.host_id !== context.userId) {
    throw new Error("Join the class before sending messages.");
  }
  await adminCreate(COLLECTIONS.classroomMessages, {
    session_id: session.id,
    sender_id: context.userId,
    body: data.body,
    school_id: session.school_id,
    created_at: new Date().toISOString(),
  });
  return { ok: true as const };
}

export async function moderateLiveParticipantHandler({
  data,
  context,
}: Args<z.infer<typeof ModerateParticipantSchema>>) {
  const session = await loadSession(data.sessionId);
  await assertCanManageSession(context.role, context.schoolId, context.userId, session);
  const patch: Record<string, unknown> = {};
  if (data.patch.mic_on !== undefined) patch["mic_on"] = data.patch.mic_on;
  if (data.patch.camera_allowed !== undefined) patch["camera_allowed"] = data.patch.camera_allowed;
  if (data.patch.cam_on !== undefined) patch["cam_on"] = data.patch.cam_on;
  if (data.patch.warned_at !== undefined) patch["warned_at"] = data.patch.warned_at;
  if (Object.keys(patch).length === 0) return { ok: true as const, count: 0 };

  if (data.targetUserId) {
    const id = participantDocId(session.id, data.targetUserId);
    const row = await adminGetById<{ session_id: string }>(COLLECTIONS.classroomParticipants, id);
    if (!row || row.session_id !== session.id) throw new Error("That participant was not found.");
    await adminUpdate(COLLECTIONS.classroomParticipants, id, patch);
    return { ok: true as const, count: 1 };
  }

  const rows = await adminWhere<{ user_id: string; left_at?: string | null }>(
    COLLECTIONS.classroomParticipants,
    "session_id",
    "==",
    session.id,
  );
  const targets = rows.filter(
    (row) => !row.left_at && row.user_id !== data.exceptUserId && row.user_id !== context.userId,
  );
  await Promise.all(
    targets.map((row) => adminUpdate(COLLECTIONS.classroomParticipants, row.id, patch)),
  );
  return { ok: true as const, count: targets.length };
}

export async function correctLiveAttendanceHandler({
  data,
  context,
}: Args<z.infer<typeof CorrectLiveAttendanceSchema>>) {
  const session = await loadSession(data.sessionId);
  await assertCanManageSession(context.role, context.schoolId, context.userId, session);
  const existing = session.lesson_id
    ? await adminWhere<{ student_id: string; status?: string }>(
        COLLECTIONS.attendance,
        "lesson_id",
        "==",
        session.lesson_id,
        [["student_id", "==", data.studentId]],
      )
    : await adminWhere<{ student_id: string; status?: string }>(
        COLLECTIONS.attendance,
        "session_id",
        "==",
        session.id,
        [["student_id", "==", data.studentId]],
      );
  const row = existing[0];
  if (!row) throw new Error("Attendance for that student was not found.");
  await adminUpdate(COLLECTIONS.attendance, row.id, {
    previous_status: row.status ?? null,
    status: data.status,
    provisional: false,
    correction_note: data.note ?? null,
    recorded_by: context.userId,
    recorded_at: new Date().toISOString(),
    session_id: session.id,
  });
  return { ok: true as const };
}
