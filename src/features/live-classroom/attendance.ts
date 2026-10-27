import { adminCreate, adminGetById, adminUpdate, adminWhere } from "@/lib/firebase/admin-repo";
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

  const enrollments = await adminWhere<{ student_id: string; status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    session.class_id,
  );
  const students = [
    ...new Set(enrollments.filter((row) => row.status !== "ended").map((row) => row.student_id)),
  ].slice(0, 80);

  const participants = await adminWhere<ParticipantRow>(
    COLLECTIONS.classroomParticipants,
    "session_id",
    "==",
    session.id,
  );
  const byUser = new Map(participants.map((row) => [row.user_id, row]));

  let absent = 0;
  for (const studentId of students) {
    const part = byUser.get(studentId);
    const status = markFromParticipation(part, minSeconds);
    if (status === "absent") absent += 1;
    const durationMs = part ? durationOf(part, endedAt) : 0;
    const body = {
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
    };

    const existing = session.lesson_id
      ? await adminWhere<{ student_id: string; session_id?: string }>(
          COLLECTIONS.attendance,
          "lesson_id",
          "==",
          session.lesson_id,
          [["student_id", "==", studentId]],
        )
      : await adminWhere<{ student_id: string; session_id?: string }>(
          COLLECTIONS.attendance,
          "session_id",
          "==",
          session.id,
          [["student_id", "==", studentId]],
        );
    const row = existing[0];
    if (row) {
      if (
        row.session_id === session.id &&
        (row as { provisional?: boolean }).provisional === false
      ) {
        continue;
      }
      await adminUpdate(COLLECTIONS.attendance, row.id, body);
    } else {
      await adminCreate(COLLECTIONS.attendance, body);
    }
  }

  return { count: students.length, absent };
}
