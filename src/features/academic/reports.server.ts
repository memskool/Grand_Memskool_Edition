import "@tanstack/react-start/server-only";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import { adminGetById, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { toClientJson } from "@/lib/firebase/plain-data";
import { requireSchoolStaffContext } from "@/lib/firebase/school-context.server";
import { parentLinkId } from "@/lib/parent-link";
import { isSchoolManager } from "@/types/roles";
import { assertCanMarkClass } from "./academic.server";
import {
  averageOf,
  bestPercent,
  inPeriod,
  letterGrade,
  percentOf,
  roundPct,
  type PeriodWindow,
} from "./report-policy";

type DataCtx<T> = { data: T; context: AuthedContext };

type PeriodDoc = { school_id: string; name?: string; starts_on: string; ends_on: string };
type AssignmentDoc = {
  school_id: string;
  class_id: string;
  title?: string;
  points?: number;
  due_at?: string | null;
  created_at?: string;
  status?: string;
};
type SubmissionDoc = {
  school_id: string;
  assignment_id: string;
  student_id: string;
  status?: string;
  grade?: number | null;
};
type AssessmentDoc = {
  school_id: string;
  class_id: string;
  title?: string;
  status?: string;
  total_points?: number;
  results_released?: boolean;
  available_from?: string | null;
  created_at?: string;
};
type AttemptDoc = {
  id: string;
  school_id: string;
  assessment_id: string;
  student_id: string;
  status?: string;
  submitted_at?: string | null;
  auto_score?: number | null;
  manual_score?: number | null;
  total_points?: number | null;
  results_released?: boolean;
};
type PrivateResultDoc = {
  auto_score?: number | null;
  manual_score?: number | null;
  total_points?: number | null;
};

export type GradeColumn = {
  id: string;
  kind: "assignment" | "assessment";
  title: string;
  max: number | null;
  date: string | null;
};
export type GradeCell = {
  percent: number | null;
  score: number | null;
  status: "marked" | "awaiting" | "missing" | "returned";
};

async function loadPeriod(schoolId: string, periodId: string | null | undefined) {
  if (!periodId) return null;
  const period = await adminGetById<PeriodDoc>(COLLECTIONS.academicPeriods, periodId);
  if (!period || period.school_id !== schoolId) throw new Error("That term was not found.");
  return period;
}

async function listPeriods(schoolId: string) {
  const rows = await adminWhere<PeriodDoc>(
    COLLECTIONS.academicPeriods,
    "school_id",
    "==",
    schoolId,
  );
  return rows
    .map((p) => ({ id: p.id, name: p.name ?? "Term", starts_on: p.starts_on, ends_on: p.ends_on }))
    .sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)));
}

/**
 * Marks for one class. `studentIds` limits the rows (report card = one student).
 * `releasedOnly` hides assessment scores the teacher has not released yet.
 */
async function computeClassGrades(input: {
  schoolId: string;
  classId: string;
  studentIds: string[];
  period: PeriodWindow;
  releasedOnly: boolean;
}) {
  const [assignments, assessments] = await Promise.all([
    adminWhere<AssignmentDoc>(COLLECTIONS.assignments, "class_id", "==", input.classId),
    adminWhere<AssessmentDoc>(COLLECTIONS.assessments, "class_id", "==", input.classId),
  ]);
  const asg = assignments
    .filter((a) => a.school_id === input.schoolId && a.status !== "draft")
    .filter((a) => inPeriod(a.due_at ?? a.created_at, input.period))
    .sort((a, b) =>
      String(a.due_at ?? a.created_at).localeCompare(String(b.due_at ?? b.created_at)),
    );
  const ass = assessments
    .filter((a) => a.school_id === input.schoolId && a.status && a.status !== "draft")
    .filter((a) => inPeriod(a.available_from ?? a.created_at, input.period))
    .sort((a, b) =>
      String(a.available_from ?? a.created_at).localeCompare(
        String(b.available_from ?? b.created_at),
      ),
    );

  const columns: GradeColumn[] = [
    ...asg.map((a) => ({
      id: a.id,
      kind: "assignment" as const,
      title: a.title ?? "Assignment",
      max: a.points ?? null,
      date: a.due_at ?? a.created_at ?? null,
    })),
    ...ass.map((a) => ({
      id: a.id,
      kind: "assessment" as const,
      title: a.title ?? "Assessment",
      max: a.total_points ?? null,
      date: a.available_from ?? a.created_at ?? null,
    })),
  ];

  const wanted = new Set(input.studentIds);
  const cells = new Map<string, Record<string, GradeCell>>();
  for (const id of input.studentIds) cells.set(id, {});

  // Assignments: one submission per student per assignment.
  const submissions = await adminWhere<SubmissionDoc>(
    COLLECTIONS.submissions,
    "class_id",
    "==",
    input.classId,
  );
  const asgIds = new Set(asg.map((a) => a.id));
  for (const s of submissions) {
    if (s.school_id !== input.schoolId || !asgIds.has(s.assignment_id) || !wanted.has(s.student_id))
      continue;
    const max = asg.find((a) => a.id === s.assignment_id)?.points ?? null;
    const row = cells.get(s.student_id)!;
    row[s.assignment_id] =
      s.status === "graded" && typeof s.grade === "number"
        ? { percent: roundPct(percentOf(s.grade, max)), score: s.grade, status: "marked" }
        : s.status === "returned"
          ? { percent: null, score: null, status: "returned" }
          : { percent: null, score: null, status: "awaiting" };
  }

  // Assessments: best attempt; unreleased scores come from the private result doc.
  for (const a of ass) {
    const attempts = (
      await adminWhere<AttemptDoc>(COLLECTIONS.assessmentSubmissions, "assessment_id", "==", a.id)
    ).filter((t) => t.school_id === input.schoolId && wanted.has(t.student_id) && t.submitted_at);
    const byStudent = new Map<string, AttemptDoc[]>();
    for (const t of attempts)
      byStudent.set(t.student_id, [...(byStudent.get(t.student_id) ?? []), t]);
    for (const [studentId, list] of byStudent) {
      const released = a.results_released === true || list.some((t) => t.results_released);
      if (input.releasedOnly && !released) {
        cells.get(studentId)![a.id] = { percent: null, score: null, status: "awaiting" };
        continue;
      }
      const scored = await Promise.all(
        list.map(async (t) => {
          const priv = await adminGetById<PrivateResultDoc>(
            COLLECTIONS.assessmentResultPrivate,
            t.id,
          );
          const score = priv?.manual_score ?? priv?.auto_score ?? t.manual_score ?? t.auto_score;
          const max = priv?.total_points ?? t.total_points ?? a.total_points ?? null;
          const awaiting = t.status === "awaiting_manual";
          return { score: awaiting ? null : (score ?? null), max, awaiting };
        }),
      );
      const best = bestPercent(scored);
      const top = scored.find((x) => percentOf(x.score, x.max) === best);
      cells.get(studentId)![a.id] =
        best === null
          ? { percent: null, score: null, status: "awaiting" }
          : { percent: roundPct(best), score: top?.score ?? null, status: "marked" };
    }
  }

  // Past-due assignments with no submission are "missing" (shown, not averaged as zero).
  const now = new Date().toISOString();
  for (const id of input.studentIds) {
    const row = cells.get(id)!;
    for (const a of asg) {
      if (!row[a.id] && a.due_at && a.due_at < now) {
        row[a.id] = { percent: null, score: null, status: "missing" };
      }
    }
  }

  return { columns, cells, assignmentIds: asgIds, assessmentIds: new Set(ass.map((a) => a.id)) };
}

async function names(ids: string[]) {
  const out = new Map<string, string>();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const u = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, id);
      out.set(id, u?.full_name?.trim() || "Student");
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* Gradebook (teacher of the class, or a school manager)               */
/* ------------------------------------------------------------------ */

export async function classGradebookHandler({
  data,
  context,
}: DataCtx<{ class_id: string; period_id: string | null }>) {
  const schoolId = await assertCanMarkClass(context, data.class_id);
  const cls = await adminGetById<{ school_id: string; name?: string }>(
    COLLECTIONS.classes,
    data.class_id,
  );
  if (!cls || cls.school_id !== schoolId) throw new Error("That class is not in your school.");
  const period = await loadPeriod(schoolId, data.period_id);

  const enrollments = await adminWhere<{ student_id: string; status?: string; school_id?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    data.class_id,
  );
  const studentIds = [
    ...new Set(
      enrollments
        .filter((e) => e.status !== "ended" && (!e.school_id || e.school_id === schoolId))
        .map((e) => e.student_id),
    ),
  ];
  const [grades, nameMap, periods] = await Promise.all([
    computeClassGrades({
      schoolId,
      classId: data.class_id,
      studentIds,
      period,
      releasedOnly: false,
    }),
    names(studentIds),
    listPeriods(schoolId),
  ]);

  const rows = studentIds
    .map((id) => {
      const cells = grades.cells.get(id) ?? {};
      const avg = roundPct(averageOf(Object.values(cells).map((c) => c.percent)));
      return {
        student_id: id,
        student_name: nameMap.get(id) ?? "Student",
        cells,
        average: avg,
        grade: letterGrade(avg)?.grade ?? null,
        missing: Object.values(cells).filter((c) => c.status === "missing").length,
      };
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name));

  return toClientJson({
    class: { id: data.class_id, name: cls.name ?? "Class" },
    period: period ? { id: data.period_id!, name: period.name ?? "Term" } : null,
    periods,
    columns: grades.columns,
    rows,
  });
}

/* ------------------------------------------------------------------ */
/* Report card (the student, a linked parent, or school staff)         */
/* ------------------------------------------------------------------ */

async function assertCanViewStudent(context: AuthedContext, studentId: string) {
  const student = await adminGetById<{
    full_name?: string;
    school_id?: string | null;
    student_code?: string | null;
    role?: string;
  }>(COLLECTIONS.users, studentId);
  if (!student?.school_id) throw new Error("That student is not attached to a school yet.");
  if (context.userId === studentId) return student;
  if (context.role === "parent") {
    const link = await adminGetById(
      COLLECTIONS.parentStudents,
      parentLinkId(context.userId, studentId),
    );
    if (link) return student;
    throw new Error("That student is not linked to your account.");
  }
  if (context.role === "teacher" || isSchoolManager(context.role)) {
    const schoolId = await requireSchoolStaffContext(context);
    if (schoolId === student.school_id) return student;
  }
  throw new Error("You do not have permission to view this report card.");
}

export async function studentReportCardHandler({
  data,
  context,
}: DataCtx<{ student_id: string; period_id: string | null }>) {
  const student = await assertCanViewStudent(context, data.student_id);
  const schoolId = student.school_id!;
  const [period, school, periods] = await Promise.all([
    loadPeriod(schoolId, data.period_id),
    adminGetById<{ name?: string; logo_url?: string | null }>(COLLECTIONS.schools, schoolId),
    listPeriods(schoolId),
  ]);

  const enrollments = (
    await adminWhere<{ class_id: string; school_id?: string; status?: string }>(
      COLLECTIONS.classEnrollments,
      "student_id",
      "==",
      data.student_id,
    )
  ).filter((e) => !e.school_id || e.school_id === schoolId);
  const classIds = [...new Set(enrollments.map((e) => e.class_id))];

  const subjects = (
    await Promise.all(
      classIds.map(async (classId) => {
        const cls = await adminGetById<{
          school_id: string;
          name?: string;
          subject_id?: string | null;
        }>(COLLECTIONS.classes, classId);
        if (!cls || cls.school_id !== schoolId) return null;
        const subject = cls.subject_id
          ? await adminGetById<{ name?: string }>(COLLECTIONS.subjects, cls.subject_id)
          : null;
        const g = await computeClassGrades({
          schoolId,
          classId,
          studentIds: [data.student_id],
          period,
          releasedOnly: true,
        });
        const cells = g.cells.get(data.student_id) ?? {};
        const pick = (ids: Set<string>) =>
          Object.entries(cells)
            .filter(([id]) => ids.has(id))
            .map(([, c]) => c.percent);
        const asgPcts = pick(g.assignmentIds);
        const assPcts = pick(g.assessmentIds);
        const overall = roundPct(averageOf([...asgPcts, ...assPcts]));
        if (!g.columns.length) return null;
        return {
          class_id: classId,
          class_name: cls.name ?? "Class",
          subject: subject?.name ?? null,
          assignments: {
            set: g.assignmentIds.size,
            marked: asgPcts.filter((p) => p !== null).length,
            average: roundPct(averageOf(asgPcts)),
          },
          assessments: {
            set: g.assessmentIds.size,
            marked: assPcts.filter((p) => p !== null).length,
            average: roundPct(averageOf(assPcts)),
          },
          missing: Object.values(cells).filter((c) => c.status === "missing").length,
          overall,
          grade: letterGrade(overall),
        };
      }),
    )
  )
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => (a.subject ?? a.class_name).localeCompare(b.subject ?? b.class_name));

  const attendanceRows = (
    await adminWhere<{ school_id?: string; status?: string; date?: string }>(
      COLLECTIONS.attendance,
      "student_id",
      "==",
      data.student_id,
    )
  ).filter((r) => r.school_id === schoolId && inPeriod(r.date ?? null, period));
  const count = (s: string) => attendanceRows.filter((r) => r.status === s).length;
  const attendance = {
    present: count("present"),
    late: count("late"),
    absent: count("absent"),
    excused: count("excused"),
    total: attendanceRows.length,
    rate: attendanceRows.length
      ? Math.round(((count("present") + count("late")) / attendanceRows.length) * 100)
      : null,
  };

  const overall = roundPct(averageOf(subjects.map((s) => s.overall)));
  return toClientJson({
    student: {
      id: data.student_id,
      name: student.full_name?.trim() || "Student",
      code: student.student_code ?? null,
    },
    school: { id: schoolId, name: school?.name ?? "School" },
    period: period
      ? {
          id: data.period_id!,
          name: period.name ?? "Term",
          starts_on: period.starts_on,
          ends_on: period.ends_on,
        }
      : null,
    periods,
    subjects,
    overall,
    grade: letterGrade(overall),
    attendance,
    generated_at: new Date().toISOString(),
  });
}

/** Linked children for the parent report-card picker. */
export async function myChildrenForReportsHandler({ context }: { context: AuthedContext }) {
  if (context.role !== "parent") return [];
  const links = await adminWhere<{ student_id: string }>(
    COLLECTIONS.parentStudents,
    "parent_id",
    "==",
    context.userId,
  );
  const nameMap = await names(links.map((l) => l.student_id));
  return links.map((l) => ({ id: l.student_id, name: nameMap.get(l.student_id) ?? "Student" }));
}
