import "@tanstack/react-start/server-only";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import { adminGetById, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { toClientJson } from "@/lib/firebase/plain-data";
import { requireSchoolManagerContext } from "@/lib/firebase/school-context.server";
import { averageOf, percentOf, roundPct } from "./report-policy";

const WINDOW_DAYS = 28;
const AT_RISK_ATTENDANCE = 75;
const AT_RISK_AVERAGE = 50;
const AT_RISK_MISSING = 3;
const MIN_MARKS_FOR_RATE = 4;

function dayStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * School-manager analytics for the last four weeks (Phase 6, section C):
 * attendance trend, students who need attention, and teacher activity.
 * Everything is computed on the server from data the school already has.
 */
export async function schoolInsightsHandler({ context }: { context: AuthedContext }) {
  const schoolId = await requireSchoolManagerContext(context);
  const now = new Date();
  const from = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000);
  const fromDay = dayStr(from);
  const fromIso = from.toISOString();
  const nowIso = now.toISOString();

  const [attendance, members, enrollments, assignments, submissions, sessions] = await Promise.all([
    adminWhere<{ student_id: string; status?: string; date?: string }>(
      COLLECTIONS.attendance,
      "school_id",
      "==",
      schoolId,
      [["date", ">=", fromDay]],
    ),
    adminWhere<{ user_id?: string; role?: string; status?: string }>(
      COLLECTIONS.schoolMembers,
      "school_id",
      "==",
      schoolId,
    ),
    adminWhere<{ student_id: string; class_id: string; status?: string }>(
      COLLECTIONS.classEnrollments,
      "school_id",
      "==",
      schoolId,
    ),
    adminWhere<{
      class_id: string;
      points?: number;
      due_at?: string | null;
      created_at?: string;
      created_by?: string | null;
      status?: string;
    }>(COLLECTIONS.assignments, "school_id", "==", schoolId),
    adminWhere<{
      assignment_id: string;
      student_id: string;
      status?: string;
      grade?: number | null;
      graded_by?: string | null;
      graded_at?: string | null;
    }>(COLLECTIONS.submissions, "school_id", "==", schoolId),
    adminWhere<{ host_id: string; started_at?: string; kind?: string | null }>(
      COLLECTIONS.classroomSessions,
      "school_id",
      "==",
      schoolId,
      [["started_at", ">=", fromIso]],
    ),
  ]);

  /* ---------- Attendance trend (4 weekly buckets) ---------- */
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = new Date(from.getTime() + i * 7 * 86_400_000);
    return { week_start: dayStr(start), attended: 0, marks: 0 };
  });
  const perStudent = new Map<string, { attended: number; marks: number }>();
  for (const row of attendance) {
    if (!row.date) continue;
    const idx = Math.min(
      3,
      Math.floor((Date.parse(row.date) - Date.parse(fromDay)) / (7 * 86_400_000)),
    );
    const attended = row.status === "present" || row.status === "late" ? 1 : 0;
    const counted = row.status !== "excused";
    if (idx >= 0 && counted) {
      weeks[idx]!.marks += 1;
      weeks[idx]!.attended += attended;
    }
    if (counted) {
      const s = perStudent.get(row.student_id) ?? { attended: 0, marks: 0 };
      s.attended += attended;
      s.marks += 1;
      perStudent.set(row.student_id, s);
    }
  }

  /* ---------- Students who need attention ---------- */
  const students = members
    .filter((m) => m.role === "student" && m.status === "approved" && m.user_id)
    .map((m) => m.user_id!);
  const activeEnrol = enrollments.filter((e) => e.status !== "ended");
  const classesOf = new Map<string, Set<string>>();
  for (const e of activeEnrol) {
    classesOf.set(e.student_id, (classesOf.get(e.student_id) ?? new Set()).add(e.class_id));
  }
  const liveAssignments = assignments.filter((a) => a.status !== "draft");
  const pointsOf = new Map(liveAssignments.map((a) => [a.id, a.points ?? null]));
  const submitted = new Set(submissions.map((s) => `${s.assignment_id}:${s.student_id}`));
  const recentDue = liveAssignments.filter(
    (a) => a.due_at && a.due_at < nowIso && a.due_at >= fromIso,
  );
  const gradedPcts = new Map<string, Array<number | null>>();
  for (const s of submissions) {
    if (s.status !== "graded" || typeof s.grade !== "number") continue;
    const pct = percentOf(s.grade, pointsOf.get(s.assignment_id) ?? null);
    gradedPcts.set(s.student_id, [...(gradedPcts.get(s.student_id) ?? []), pct]);
  }

  const atRiskRaw = students
    .map((id) => {
      const att = perStudent.get(id);
      const rate =
        att && att.marks >= MIN_MARKS_FOR_RATE
          ? Math.round((att.attended / att.marks) * 100)
          : null;
      const classes = classesOf.get(id) ?? new Set<string>();
      const missing = recentDue.filter(
        (a) => classes.has(a.class_id) && !submitted.has(`${a.id}:${id}`),
      ).length;
      const pcts = gradedPcts.get(id) ?? [];
      const average = pcts.filter((p) => p !== null).length >= 2 ? roundPct(averageOf(pcts)) : null;
      const reasons: string[] = [];
      if (rate !== null && rate < AT_RISK_ATTENDANCE) reasons.push(`attendance ${rate}%`);
      if (missing >= AT_RISK_MISSING) reasons.push(`${missing} missing assignments`);
      if (average !== null && average < AT_RISK_AVERAGE)
        reasons.push(`average ${Math.round(average)}%`);
      return { student_id: id, attendance_rate: rate, missing, average, reasons };
    })
    .filter((r) => r.reasons.length > 0)
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        (a.attendance_rate ?? 101) - (b.attendance_rate ?? 101),
    )
    .slice(0, 30);

  /* ---------- Teacher activity ---------- */
  const teacherIds = members
    .filter((m) => m.role === "teacher" && m.status === "approved" && m.user_id)
    .map((m) => m.user_id!);
  const teachers = teacherIds.map((id) => {
    const live = sessions.filter((s) => s.host_id === id && s.kind !== "gold");
    const set = liveAssignments.filter(
      (a) => a.created_by === id && (a.created_at ?? "") >= fromIso,
    );
    const marked = submissions.filter((s) => s.graded_by === id && (s.graded_at ?? "") >= fromIso);
    const last = [
      ...live.map((s) => s.started_at ?? ""),
      ...set.map((a) => a.created_at ?? ""),
      ...marked.map((s) => s.graded_at ?? ""),
    ]
      .filter(Boolean)
      .sort()
      .at(-1);
    return {
      teacher_id: id,
      live_sessions: live.length,
      assignments_set: set.length,
      marked: marked.length,
      last_active: last ?? null,
    };
  });

  const nameIds = [...atRiskRaw.map((r) => r.student_id), ...teacherIds];
  const names = new Map<string, string>();
  await Promise.all(
    [...new Set(nameIds)].map(async (id) => {
      const u = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, id);
      names.set(id, u?.full_name?.trim() || "Unnamed");
    }),
  );

  return toClientJson({
    window_days: WINDOW_DAYS,
    attendance: weeks.map((w) => ({
      week_start: w.week_start,
      marks: w.marks,
      rate: w.marks ? Math.round((w.attended / w.marks) * 100) : null,
    })),
    students_total: students.length,
    at_risk: atRiskRaw.map((r) => ({ ...r, name: names.get(r.student_id) ?? "Student" })),
    teachers: teachers
      .map((t) => ({ ...t, name: names.get(t.teacher_id) ?? "Teacher" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}
