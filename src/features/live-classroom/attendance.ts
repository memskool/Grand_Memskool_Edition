import { adminGetById, adminSet, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { AttendanceStatus } from "@/types/academic";
import type { SessionDoc } from "./authz";

type ParticipantRow = {
  user_id: string;
  is_host?: boolean;
  connected_at?: string | null;
  duration_ms?: number;
  left_at?: string | null;
  last_connected_at?: string | null;
};

type SchoolPolicy = {
  live_attendance_min_seconds?: number | null;
};

/** Deterministic id so a later live on the same lesson cannot clobber this session. */
export function liveAttendanceDocId(sessionId: string, studentId: string): string {
  return `live_${sessionId}_${studentId}`;
}

function durationOf(row: ParticipantRow, endedAt: string): number {
  let ms = row.duration_ms ?? 0;
  if (!row.left_at && (row.last_connected_at || row.connected_at)) {
    const start = Date.parse(row.last_connected_at ?? row.connected_at ?? "");
    const end = Date.parse(endedAt);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) ms += end - start;
  }
  return ms;
}

export function markFromParticipation(
  row: ParticipantRow | undefined,
  minSeconds: number,
): AttendanceStatus {
  if (!row?.connected_at) return "absent";
  if (durationOf(row, new Date().toISOString()) < minSeconds * 1000) return "absent";
  return "present";
}

const ENROLLMENT_PAGE = 200;

async function loadActiveStudentIds(classId: string): Promise<string[]> {
  const enrollments = await adminWhere<{ student_id: string; status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    classId,
  );
  return [
    ...new Set(enrollments.filter((row) => row.status !== "ended").map((row) => row.student_id)),
  ];
}

export async function finalizeLiveAttendance(input: {
  session: SessionDoc & { id: string };
  recordedBy: string;
}): Promise<{ count: number; absent: number }> {
  const session = input.session;
  if (!session.school_id || session.kind === "gold") {
    return { count: 0, absent: 0 };
  }
  const school = await adminGetById<SchoolPolicy>(COLLECTIONS.schools, session.school_id);
  const minSeconds = Math.max(0, school?.live_attendance_min_seconds ?? 0);
  const endedAt = new Date().toISOString();
  const date = (session.started_at ?? endedAt).slice(0, 10);

  const students = await loadActiveStudentIds(session.class_id);

  const participants = await adminWhere<ParticipantRow>(
    COLLECTIONS.classroomParticipants,
    "session_id",
    "==",
    session.id,
  );
  const byUser = new Map(participants.map((row) => [row.user_id, row]));

  let absent = 0;
  // Phase 6: write in pages — no hard 80-student drop.
  for (let i = 0; i < students.length; i += ENROLLMENT_PAGE) {
    const page = students.slice(i, i + ENROLLMENT_PAGE);
    await Promise.all(
      page.map(async (studentId) => {
        const part = byUser.get(studentId);
        const status = markFromParticipation(part, minSeconds);
        if (status === "absent") absent += 1;
        const durationMs = part ? durationOf(part, endedAt) : 0;
        const id = liveAttendanceDocId(session.id, studentId);
        const existing = await adminGetById<{ provisional?: boolean; session_id?: string }>(
          COLLECTIONS.attendance,
          id,
        );
        if (existing?.provisional === false && existing.session_id === session.id) {
          return;
        }
        await adminSet(COLLECTIONS.attendance, id, {
          school_id: session.school_id,
          class_id: session.class_id,
          student_id: studentId,
          lesson_id: session.lesson_id ?? null,
          session_id: session.id,
          status,
          source: "live_session",
          provisional: true,
          duration_ms: durationMs,
          connected_at: part?.connected_at ?? null,
          recorded_by: input.recordedBy,
          recorded_at: endedAt,
          date,
          previous_status: null,
          correction_note: null,
        });
      }),
    );
  }

  return { count: students.length, absent };
}

/** Absentee ids for missed-work notifications — paginated, no silent 80 cap. */
export async function listLiveAbsenteeStudentIds(
  session: SessionDoc & { id: string },
): Promise<string[]> {
  if (!session.school_id || session.kind === "gold") return [];
  const students = await loadActiveStudentIds(session.class_id);
  const participants = await adminWhere<{ user_id: string; connected_at?: string | null }>(
    COLLECTIONS.classroomParticipants,
    "session_id",
    "==",
    session.id,
  );
  const present = new Set(participants.filter((row) => row.connected_at).map((row) => row.user_id));
  return students.filter((id) => !present.has(id));
}
