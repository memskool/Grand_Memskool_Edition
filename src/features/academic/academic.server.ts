import "@tanstack/react-start/server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import {
  adminCreate,
  adminDelete,
  adminGetById,
  adminSet,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { adminAuth } from "@/lib/firebase/admin.server";
import { toClientJson } from "@/lib/firebase/plain-data";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { isSchoolManager } from "@/types/roles";
import {
  requireSchoolManagerContext,
  requireSchoolStaffContext,
} from "@/lib/firebase/school-context.server";
import { classEnrollmentId, classTeacherAssignmentId } from "./ids";
import { canSubmit, formatMark, needsMarking, validateGrade } from "./grading-policy";

// Handlers receive already-validated payloads from thin createServerFn facades.
type Ctx = { context: AuthedContext };
type DataCtx<T> = { data: T; context: AuthedContext };

type ClassDoc = {
  id: string;
  name: string;
  room?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  school_id: string;
  status?: string;
};

async function ensureMemberClaims(input: {
  userId: string;
  schoolId: string;
  role: string;
  approved?: boolean;
}) {
  const profile = await adminGetById<{ role?: string; school_id?: string | null }>(
    COLLECTIONS.users,
    input.userId,
  );
  if (!profile || profile.school_id !== input.schoolId) {
    await adminSet(COLLECTIONS.users, input.userId, {
      school_id: input.schoolId,
      membership_status: "approved",
      role: profile?.role ?? input.role,
      updated_at: new Date().toISOString(),
    });
  }
  const claimRole =
    (profile?.role ?? input.role) === "institution" ? "admin" : (profile?.role ?? input.role);
  try {
    await adminAuth().setCustomUserClaims(input.userId, {
      role: claimRole,
      schoolId: input.schoolId,
      approved: input.approved !== false,
    });
  } catch (error) {
    console.error("[academic] claims sync failed:", error);
  }
}

async function notifyUser(input: {
  userId: string;
  schoolId: string;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    const { createAndQueueNotification, dispatchNotifications } =
      await import("@/lib/notifications.server");
    await createAndQueueNotification({
      userId: input.userId,
      title: input.title,
      body: input.body,
      kind: "academic",
      link: input.link ?? "/dashboard",
      schoolId: input.schoolId,
      createdAt: new Date().toISOString(),
    });
    void dispatchNotifications();
  } catch (error) {
    console.error("[academic] notify failed:", error);
  }
}

async function classRowsForIds(classIds: string[]) {
  const unique = [...new Set(classIds.filter(Boolean))];
  const rows = await Promise.all(
    unique.map(async (id) => {
      const cls = await adminGetById<ClassDoc>(COLLECTIONS.classes, id);
      if (!cls || cls.status === "archived") return null;
      const subject = cls.subject_id
        ? await adminGetById<{ name: string; code: string }>(COLLECTIONS.subjects, cls.subject_id)
        : null;
      return {
        id: cls.id,
        name: cls.name,
        room: cls.room ?? null,
        subject: subject ? { name: subject.name, code: subject.code } : null,
      };
    }),
  );
  return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function schoolOf(context: AuthedContext): string {
  if (!context.schoolId) throw new Error("You are not attached to a school.");
  return context.schoolId;
}

async function requireManager(context: AuthedContext) {
  // Claims first; heal stale JWT when profile + ownership prove school operator.
  return requireSchoolManagerContext(context);
}

async function requireStaff(context: AuthedContext) {
  // Teachers: claims only. Managers: heal stale Institution JWT like enrol/create-class.
  return requireSchoolStaffContext(context);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export async function createAcademicClassHandler({
  data,
  context,
}: DataCtx<{
  name: string;
  room: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  academic_year_id?: string | null;
  academic_period_id?: string | null;
  status?: string;
}>) {
  const schoolId = await requireManager(context);
  const now = new Date().toISOString();
  const id = await adminCreate(COLLECTIONS.classes, {
    school_id: schoolId,
    name: data.name,
    room: data.room,
    subject_id: data.subject_id,
    teacher_id: data.teacher_id,
    academic_year_id: data.academic_year_id ?? null,
    academic_period_id: data.academic_period_id ?? null,
    status: data.status ?? "active",
    created_at: now,
    updated_at: now,
  });
  return toClientJson({ id });
}

export async function enrollStudentHandler({
  data,
  context,
}: DataCtx<{ class_id: string; student_id: string }>) {
  const schoolId = await requireManager(context);
  const cls = await adminGetById<{
    school_id: string;
    name?: string;
    academic_year_id?: string | null;
    academic_period_id?: string | null;
    status?: string;
  }>(COLLECTIONS.classes, data.class_id);
  if (!cls || cls.school_id !== schoolId) throw new Error("That class is not in your school.");
  if (cls.status === "archived") throw new Error("That class is archived.");
  const student = await adminGetById<{ school_id?: string | null }>(
    COLLECTIONS.users,
    data.student_id,
  );
  const member = await adminGetById<{ school_id?: string; status?: string; role?: string }>(
    COLLECTIONS.schoolMembers,
    data.student_id,
  );
  const onRoll =
    (member?.school_id === schoolId &&
      member.status === "approved" &&
      (member.role === "student" || member.role === "teacher")) ||
    student?.school_id === schoolId;
  if (!onRoll) {
    throw new Error("That student is not on your school roll. Approve their application first.");
  }

  const existing = await adminWhere<{ student_id: string; class_id: string; status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    data.class_id,
    [["student_id", "==", data.student_id]],
  );
  const active = existing.find((row) => row.status !== "ended");
  if (active) {
    await ensureMemberClaims({
      userId: data.student_id,
      schoolId,
      role: "student",
    });
    return toClientJson({ id: active.id });
  }

  const now = new Date().toISOString();
  const id = classEnrollmentId(data.class_id, data.student_id);
  await adminSet(COLLECTIONS.classEnrollments, id, {
    school_id: schoolId,
    class_id: data.class_id,
    student_id: data.student_id,
    academic_year_id: cls.academic_year_id ?? null,
    academic_period_id: cls.academic_period_id ?? null,
    status: "active",
    started_at: now,
    ended_at: null,
  });
  await ensureMemberClaims({
    userId: data.student_id,
    schoolId,
    role: "student",
  });
  await notifyUser({
    userId: data.student_id,
    schoolId,
    title: "You were enrolled in a class",
    body: `You are now in ${cls.name ?? "your class"}. Open your dashboard to join lessons and see work.`,
    link: "/dashboard",
  });
  return toClientJson({ id });
}

export async function endEnrollmentHandler({ data, context }: DataCtx<{ enrollment_id: string }>) {
  const schoolId = await requireManager(context);
  const row = await adminGetById<{ school_id: string }>(
    COLLECTIONS.classEnrollments,
    data.enrollment_id,
  );
  if (!row || row.school_id !== schoolId) throw new Error("That membership was not found.");
  await adminUpdate(COLLECTIONS.classEnrollments, data.enrollment_id, {
    status: "ended",
    ended_at: new Date().toISOString(),
  });
  return { ok: true as const };
}

export async function assignClassTeacherHandler({
  data,
  context,
}: DataCtx<{ class_id: string; teacher_id: string; subject_id: string }>) {
  const schoolId = await requireManager(context);
  const cls = await adminGetById<{
    school_id: string;
    name?: string;
    teacher_id?: string | null;
  }>(COLLECTIONS.classes, data.class_id);
  if (!cls || cls.school_id !== schoolId) throw new Error("That class is not in your school.");
  const teacher = await adminGetById<{ school_id?: string | null; role?: string }>(
    COLLECTIONS.users,
    data.teacher_id,
  );
  const member = await adminGetById<{ school_id?: string; status?: string; role?: string }>(
    COLLECTIONS.schoolMembers,
    data.teacher_id,
  );
  const onStaff =
    teacher?.school_id === schoolId ||
    (member?.school_id === schoolId &&
      member.status === "approved" &&
      (member.role === "teacher" || member.role === "admin" || member.role === "institution"));
  if (!onStaff) throw new Error("That teacher is not in your school.");

  const existing = await adminWhere<{
    teacher_id: string;
    class_id: string;
    subject_id: string;
    status?: string;
  }>(COLLECTIONS.classTeacherAssignments, "class_id", "==", data.class_id, [
    ["teacher_id", "==", data.teacher_id],
    ["subject_id", "==", data.subject_id],
  ]);
  const active = existing.find((row) => row.status !== "ended");
  if (active) {
    await ensureMemberClaims({
      userId: data.teacher_id,
      schoolId,
      role: "teacher",
    });
    if (!cls.teacher_id) {
      await adminUpdate(COLLECTIONS.classes, data.class_id, {
        teacher_id: data.teacher_id,
        updated_at: new Date().toISOString(),
      });
    }
    return toClientJson({ id: active.id });
  }
  const now = new Date().toISOString();
  const id = classTeacherAssignmentId(data.class_id, data.teacher_id, data.subject_id);
  await adminSet(COLLECTIONS.classTeacherAssignments, id, {
    school_id: schoolId,
    ...data,
    status: "active",
    started_at: now,
    ended_at: null,
  });
  await adminUpdate(COLLECTIONS.classes, data.class_id, {
    teacher_id: data.teacher_id,
    updated_at: now,
  });
  await ensureMemberClaims({
    userId: data.teacher_id,
    schoolId,
    role: "teacher",
  });
  const subject = await adminGetById<{ name?: string }>(COLLECTIONS.subjects, data.subject_id);
  await notifyUser({
    userId: data.teacher_id,
    schoolId,
    title: "You were assigned to a class",
    body: `You now teach ${subject?.name ?? "a subject"} in ${cls.name ?? "a class"}. Open your dashboard to start lessons.`,
    link: "/dashboard",
  });
  return toClientJson({ id });
}

/** Teacher: classes from ownership + active subject assignments (tenant-scoped). */
export async function listMyTeachingClassesHandler({ context }: Ctx) {
  const userId = context.userId;
  const schoolId = context.schoolId;
  const owned = await adminWhere<ClassDoc>(COLLECTIONS.classes, "teacher_id", "==", userId);
  const assigned = await adminWhere<{ class_id: string; status?: string; school_id?: string }>(
    COLLECTIONS.classTeacherAssignments,
    "teacher_id",
    "==",
    userId,
    [["status", "==", "active"]],
  );
  const classIds = [
    ...owned
      .filter((row) => row.status !== "archived" && (!schoolId || row.school_id === schoolId))
      .map((row) => row.id),
    ...assigned.filter((row) => !schoolId || row.school_id === schoolId).map((row) => row.class_id),
  ];
  return toClientJson(await classRowsForIds(classIds));
}

/** Student: active class enrolments (tenant-scoped). */
export async function listMyEnrolledClassesHandler({ context }: Ctx) {
  const schoolId = context.schoolId;
  const enrollments = await adminWhere<{
    class_id: string;
    status?: string;
    school_id?: string;
  }>(COLLECTIONS.classEnrollments, "student_id", "==", context.userId);
  const classIds = enrollments
    .filter((row) => row.status !== "ended" && (!schoolId || row.school_id === schoolId))
    .map((row) => row.class_id);
  return toClientJson(await classRowsForIds(classIds));
}

/** School admin: roster for one class. */
export async function listClassRosterHandler({ data, context }: DataCtx<{ class_id: string }>) {
  const schoolId = await requireManager(context);
  const cls = await adminGetById<{ school_id: string }>(COLLECTIONS.classes, data.class_id);
  if (!cls || cls.school_id !== schoolId) throw new Error("That class is not in your school.");
  const rows = await adminWhere<{
    student_id: string;
    status?: string;
    started_at?: string;
    ended_at?: string | null;
    class_id: string;
    school_id: string;
  }>(COLLECTIONS.classEnrollments, "class_id", "==", data.class_id);
  const forClass = rows.filter((row) => row.school_id === schoolId);
  return toClientJson(
    await Promise.all(
      forClass.map(async (row) => {
        const student = await adminGetById<{ full_name: string; email: string | null }>(
          COLLECTIONS.users,
          row.student_id,
        );
        return {
          ...row,
          student: student ? { full_name: student.full_name, email: student.email ?? null } : null,
        };
      }),
    ),
  );
}

export async function endClassTeacherHandler({
  data,
  context,
}: DataCtx<{ assignment_id: string }>) {
  const schoolId = await requireManager(context);
  const row = await adminGetById<{ school_id: string }>(
    COLLECTIONS.classTeacherAssignments,
    data.assignment_id,
  );
  if (!row || row.school_id !== schoolId) throw new Error("That assignment was not found.");
  await adminUpdate(COLLECTIONS.classTeacherAssignments, data.assignment_id, {
    status: "ended",
    ended_at: new Date().toISOString(),
  });
  return { ok: true as const };
}

export async function createTimetableSlotSafeHandler({
  data,
  context,
}: DataCtx<{
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  academic_period_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
}>) {
  const schoolId = await requireStaff(context);
  if (data.start_time >= data.end_time) throw new Error("The class must end after it starts.");
  const cls = await adminGetById<{ school_id: string }>(COLLECTIONS.classes, data.class_id);
  if (!cls || cls.school_id !== schoolId) throw new Error("That class is not in your school.");

  const slots = await adminWhere<{
    class_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>(COLLECTIONS.timetableSlots, "class_id", "==", data.class_id, [
    ["day_of_week", "==", data.day_of_week],
  ]);
  if (slots.some((s) => overlaps(data.start_time, data.end_time, s.start_time, s.end_time))) {
    throw new Error("That class already has a lesson in this time.");
  }

  const id = await adminCreate(COLLECTIONS.timetableSlots, {
    ...data,
    school_id: schoolId,
    created_at: new Date().toISOString(),
  });
  return { id };
}

export async function submitAssignmentWorkHandler({
  data,
  context,
}: DataCtx<{ assignment_id: string; text_body?: string | null; storage_paths: string[] }>) {
  if (context.role !== "student") throw new Error("Only students can submit this work.");
  const schoolId = schoolOf(context);
  const assignment = await adminGetById<{
    school_id: string;
    class_id: string;
    due_at?: string | null;
    status?: string;
    allow_resubmit?: boolean;
  }>(COLLECTIONS.assignments, data.assignment_id);
  if (!assignment || assignment.school_id !== schoolId) {
    throw new Error("That assignment is not available.");
  }
  if (assignment.status === "draft") throw new Error("This assignment is not published yet.");
  if (assignment.status === "closed") throw new Error("This assignment is closed.");
  if (!data.text_body?.trim() && data.storage_paths.length === 0) {
    throw new Error("Add written work or a file before submitting.");
  }

  const membership = await adminWhere<{ status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    assignment.class_id,
    [["student_id", "==", context.userId]],
  );
  if (!membership.some((row) => row.status !== "ended")) {
    throw new Error("You are not enrolled in that class.");
  }

  const prior = await adminWhere<{ student_id: string; assignment_id: string }>(
    COLLECTIONS.submissions,
    "assignment_id",
    "==",
    data.assignment_id,
    [["student_id", "==", context.userId]],
  );
  const submittedAt = new Date().toISOString();
  const late = Boolean(assignment.due_at && submittedAt > assignment.due_at);
  const status = late ? "late" : "submitted";
  const payload = {
    school_id: schoolId,
    assignment_id: data.assignment_id,
    student_id: context.userId,
    class_id: assignment.class_id,
    status,
    text_body: data.text_body,
    storage_paths: data.storage_paths,
    submitted_at: submittedAt,
    submitted_at_server: FieldValue.serverTimestamp(),
    late,
    feedback: null,
    grade: null,
    updated_at: submittedAt,
  };

  const existing = prior[0] as ((typeof prior)[number] & { status?: string }) | undefined;
  if (existing) {
    const allowed = canSubmit(existing, assignment.allow_resubmit);
    if (!allowed.ok) throw new Error(allowed.reason);
    await adminUpdate(COLLECTIONS.submissions, existing.id, {
      ...payload,
      graded_at: null,
      graded_by: null,
      returned_at: null,
      resubmitted_at: submittedAt,
    });
    return { id: existing.id, status, late };
  }
  const id = await adminCreate(COLLECTIONS.submissions, payload);
  return { id, status, late };
}

type AssignmentDoc = {
  school_id: string;
  class_id: string;
  title?: string;
  points?: number;
  due_at?: string | null;
  status?: string;
  teacher_id?: string | null;
};

type SubmissionDoc = {
  school_id: string;
  assignment_id: string;
  student_id: string;
  class_id?: string | null;
  status: string;
  text_body?: string | null;
  storage_paths?: string[];
  submitted_at?: string | null;
  late?: boolean;
  grade?: number | null;
  feedback?: string | null;
  graded_at?: string | null;
  returned_at?: string | null;
};

/** Teacher of the class (owner or active assignment) or a school manager of that school. */
async function assertCanMarkClass(context: AuthedContext, classId: string): Promise<string> {
  const schoolId = await requireStaff(context);
  if (context.role === "teacher") {
    const { isAssignedTeacher } = await import("@/features/live-classroom/authz");
    if (!(await isAssignedTeacher(classId, context.userId))) {
      throw new Error("You do not teach this class.");
    }
  }
  return schoolId;
}

async function loadAssignmentForMarking(context: AuthedContext, assignmentId: string) {
  const assignment = await adminGetById<AssignmentDoc>(COLLECTIONS.assignments, assignmentId);
  if (!assignment) throw new Error("That assignment was not found.");
  const schoolId = await assertCanMarkClass(context, assignment.class_id);
  if (assignment.school_id !== schoolId) throw new Error("That assignment is not in your school.");
  return assignment;
}

/**
 * Teacher (or manager) posts an assignment to a class. Server-side so the class-teacher
 * check holds and every enrolled learner is notified (in-app, email, web push).
 */
export async function createAssignmentHandler({
  data,
  context,
}: DataCtx<{
  class_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  points: number;
}>) {
  const schoolId = await assertCanMarkClass(context, data.class_id);
  const cls = await adminGetById<{ school_id: string; name?: string; status?: string }>(
    COLLECTIONS.classes,
    data.class_id,
  );
  if (!cls || cls.school_id !== schoolId) throw new Error("That class is not in your school.");
  if (cls.status === "archived") throw new Error("That class is archived.");
  const now = new Date().toISOString();
  const id = await adminCreate(COLLECTIONS.assignments, {
    class_id: data.class_id,
    title: data.title,
    description: data.description || null,
    due_at: data.due_at,
    points: data.points,
    created_by: context.userId,
    teacher_id: context.userId,
    school_id: schoolId,
    status: "published",
    allow_resubmit: true,
    created_at: now,
    updated_at: now,
  });

  const enrollments = await adminWhere<{ student_id: string; status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    data.class_id,
  );
  const studentIds = enrollments
    .filter((row) => row.status !== "ended")
    .map((row) => row.student_id);
  try {
    const { notifyUsers } = await import("@/lib/notifications.server");
    const due = data.due_at
      ? ` Due ${new Date(data.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`
      : "";
    await notifyUsers(studentIds, {
      title: "New assignment",
      body: `${data.title}${cls.name ? ` · ${cls.name}` : ""}.${due}`,
      kind: "academic",
      link: "/dashboard",
      schoolId,
      createdAt: now,
    });
  } catch (error) {
    // The assignment is saved; a notification outage must not report a failure.
    console.error("[academic] assignment notify failed:", error);
  }
  return { id, notified: studentIds.length };
}

/** Deletes an assignment nobody has handed in yet. Work already submitted is never lost. */
export async function deleteAssignmentHandler({
  data,
  context,
}: DataCtx<{ assignment_id: string }>) {
  const assignment = await loadAssignmentForMarking(context, data.assignment_id);
  const submissions = await adminWhere<{ id: string }>(
    COLLECTIONS.submissions,
    "assignment_id",
    "==",
    assignment.id,
  );
  if (submissions.length) {
    throw new Error(
      `${submissions.length} student${submissions.length === 1 ? " has" : "s have"} already handed in work, so this assignment cannot be deleted.`,
    );
  }
  await adminDelete(COLLECTIONS.assignments, assignment.id);
  return { ok: true as const };
}

/** Every enrolled student with their submission (or none) for one assignment. */
export async function listAssignmentSubmissionsHandler({
  data,
  context,
}: DataCtx<{ assignment_id: string }>) {
  const assignment = await loadAssignmentForMarking(context, data.assignment_id);
  const [enrollments, submissions] = await Promise.all([
    adminWhere<{ student_id: string; status?: string }>(
      COLLECTIONS.classEnrollments,
      "class_id",
      "==",
      assignment.class_id,
    ),
    adminWhere<SubmissionDoc>(COLLECTIONS.submissions, "assignment_id", "==", assignment.id),
  ]);
  const bySubmitter = new Map(submissions.map((s) => [s.student_id, s]));
  const studentIds = [
    ...new Set([
      ...enrollments.filter((e) => e.status !== "ended").map((e) => e.student_id),
      // Keep work from students who have since left the class visible to the teacher.
      ...submissions.map((s) => s.student_id),
    ]),
  ];
  const rows = await Promise.all(
    studentIds.map(async (studentId) => {
      const user = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, studentId);
      const sub = bySubmitter.get(studentId) ?? null;
      return {
        student_id: studentId,
        student_name: user?.full_name ?? "Student",
        submission: sub
          ? {
              id: sub.id,
              status: sub.status,
              text_body: sub.text_body ?? null,
              storage_paths: sub.storage_paths ?? [],
              submitted_at: sub.submitted_at ?? null,
              late: Boolean(sub.late),
              grade: typeof sub.grade === "number" ? sub.grade : null,
              feedback: sub.feedback ?? null,
              graded_at: sub.graded_at ?? null,
              returned_at: sub.returned_at ?? null,
            }
          : null,
      };
    }),
  );
  rows.sort((a, b) => a.student_name.localeCompare(b.student_name));
  return toClientJson({
    assignment: {
      id: assignment.id,
      title: assignment.title ?? "Assignment",
      points: assignment.points ?? 100,
      due_at: assignment.due_at ?? null,
      class_id: assignment.class_id,
    },
    rows,
  });
}

/** Mark (grade + optional feedback) or return for changes. Server-only write. */
export async function markSubmissionHandler({
  data,
  context,
}: DataCtx<
  | { action: "grade"; submission_id: string; grade: number; feedback: string | null }
  | { action: "return"; submission_id: string; feedback: string }
>) {
  const submission = await adminGetById<SubmissionDoc>(COLLECTIONS.submissions, data.submission_id);
  if (!submission) throw new Error("That submission was not found.");
  const assignment = await loadAssignmentForMarking(context, submission.assignment_id);
  if (submission.school_id !== assignment.school_id) {
    throw new Error("That submission is not in your school.");
  }
  const now = new Date().toISOString();
  const title = assignment.title ?? "your assignment";

  if (data.action === "grade") {
    const points = assignment.points ?? 100;
    const problem = validateGrade(data.grade, points);
    if (problem) throw new Error(problem);
    await adminUpdate(COLLECTIONS.submissions, submission.id, {
      status: "graded",
      grade: data.grade,
      feedback: data.feedback?.trim() || null,
      graded_at: now,
      graded_by: context.userId,
      returned_at: null,
      updated_at: now,
    });
    await notifyUser({
      userId: submission.student_id,
      schoolId: assignment.school_id,
      title: "Your work was marked",
      body: `${title}: ${formatMark(data.grade, points)}${data.feedback?.trim() ? " — feedback added" : ""}.`,
      link: "/dashboard",
    });
    return { ok: true as const, status: "graded" as const };
  }

  await adminUpdate(COLLECTIONS.submissions, submission.id, {
    status: "returned",
    grade: null,
    feedback: data.feedback.trim(),
    graded_at: null,
    graded_by: context.userId,
    returned_at: now,
    updated_at: now,
  });
  await notifyUser({
    userId: submission.student_id,
    schoolId: assignment.school_id,
    title: "Your work was returned for changes",
    body: `${title}: your teacher left feedback. Update your work and submit again.`,
    link: "/dashboard",
  });
  return { ok: true as const, status: "returned" as const };
}

/** Work waiting for this teacher's decision, oldest first, across every class they teach. */
export async function listPendingGradingHandler({ context }: Ctx) {
  const schoolId = await requireStaff(context);
  let classIds: string[];
  if (context.role === "teacher") {
    const owned = await adminWhere<ClassDoc>(
      COLLECTIONS.classes,
      "teacher_id",
      "==",
      context.userId,
    );
    const assigned = await adminWhere<{ class_id: string; school_id?: string }>(
      COLLECTIONS.classTeacherAssignments,
      "teacher_id",
      "==",
      context.userId,
      [["status", "==", "active"]],
    );
    classIds = [
      ...owned.filter((c) => c.school_id === schoolId && c.status !== "archived").map((c) => c.id),
      ...assigned.filter((a) => !a.school_id || a.school_id === schoolId).map((a) => a.class_id),
    ];
  } else {
    const classes = await adminWhere<ClassDoc>(COLLECTIONS.classes, "school_id", "==", schoolId);
    classIds = classes.filter((c) => c.status !== "archived").map((c) => c.id);
  }
  classIds = [...new Set(classIds)];
  if (classIds.length === 0) return toClientJson([]);

  const perClass = await Promise.all(
    classIds.map((classId) =>
      adminWhere<SubmissionDoc>(COLLECTIONS.submissions, "class_id", "==", classId),
    ),
  );
  const pending = perClass
    .flat()
    .filter((s) => s.school_id === schoolId && needsMarking(s.status, s.grade))
    .sort((a, b) => String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? "")))
    .slice(0, 50);

  const assignmentCache = new Map<string, Promise<(AssignmentDoc & { id: string }) | null>>();
  const classCache = new Map<string, Promise<{ name?: string } | null>>();
  const rows = await Promise.all(
    pending.map(async (s) => {
      if (!assignmentCache.has(s.assignment_id)) {
        assignmentCache.set(
          s.assignment_id,
          adminGetById<AssignmentDoc>(COLLECTIONS.assignments, s.assignment_id),
        );
      }
      const assignment = await assignmentCache.get(s.assignment_id)!;
      const classId = assignment?.class_id ?? s.class_id ?? null;
      if (classId && !classCache.has(classId)) {
        classCache.set(classId, adminGetById<{ name?: string }>(COLLECTIONS.classes, classId));
      }
      const cls = classId ? await classCache.get(classId)! : null;
      const student = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, s.student_id);
      return {
        id: s.id,
        assignment_id: s.assignment_id,
        student_id: s.student_id,
        status: s.status,
        late: Boolean(s.late),
        submitted_at: s.submitted_at ?? null,
        student: { full_name: student?.full_name ?? "Student" },
        assignment: assignment
          ? {
              title: assignment.title ?? "Assignment",
              class: cls ? { name: cls.name ?? "" } : null,
            }
          : null,
      };
    }),
  );
  return toClientJson(rows);
}

export async function recordLessonAttendanceHandler({
  data,
  context,
}: DataCtx<{ lesson_id: string; marks: Array<{ student_id: string; status: string }> }>) {
  const schoolId = await requireStaff(context);
  const lesson = await adminGetById<{
    school_id: string;
    class_id: string;
    teacher_id: string;
    starts_at?: string | null;
  }>(COLLECTIONS.lessons, data.lesson_id);
  if (!lesson || lesson.school_id !== schoolId) throw new Error("That lesson was not found.");
  if (context.role === "teacher" && lesson.teacher_id !== context.userId) {
    throw new Error("You can only record attendance for your own lessons.");
  }
  const date = (lesson.starts_at ?? new Date().toISOString()).slice(0, 10);
  const recordedAt = new Date().toISOString();
  for (const mark of data.marks) {
    const existing = await adminWhere<{ student_id: string; lesson_id: string }>(
      COLLECTIONS.attendance,
      "lesson_id",
      "==",
      data.lesson_id,
      [["student_id", "==", mark.student_id]],
    );
    const body = {
      school_id: schoolId,
      lesson_id: data.lesson_id,
      class_id: lesson.class_id,
      student_id: mark.student_id,
      status: mark.status,
      recorded_by: context.userId,
      recorded_at: recordedAt,
      date,
    };
    const row = existing[0];
    if (row) await adminUpdate(COLLECTIONS.attendance, row.id, body);
    else await adminCreate(COLLECTIONS.attendance, body);
  }
  return { ok: true as const, count: data.marks.length };
}

export async function assignMissedWorkHandler({
  data,
  context,
}: DataCtx<{
  student_id: string;
  lesson_id: string | null;
  class_id: string | null;
  subject_id: string | null;
  assignment_id: string | null;
  material_id: string | null;
  title: string;
}>) {
  const schoolId = await requireStaff(context);
  const now = new Date().toISOString();
  const id = await adminCreate(COLLECTIONS.missedWork, {
    school_id: schoolId,
    student_id: data.student_id,
    lesson_id: data.lesson_id,
    class_id: data.class_id,
    subject_id: data.subject_id,
    assignment_id: data.assignment_id,
    material_id: data.material_id,
    title: data.title,
    status: "pending",
    completed_at: null,
    created_by: context.userId,
    created_at: now,
    lesson_date: now.slice(0, 10),
    reviewed: false,
    reviewed_at: null,
    released_to_locker: false,
    url: null,
    file_path: null,
    file_name: null,
    category: "course_material",
  });
  return { id };
}

export async function updateMissedWorkStatusHandler({
  data,
  context,
}: DataCtx<{ id: string; status: string }>) {
  const row = await adminGetById<{ school_id: string; student_id: string }>(
    COLLECTIONS.missedWork,
    data.id,
  );
  if (!row) throw new Error("That missed-work item was not found.");
  const isOwner = row.student_id === context.userId;
  const isStaff = context.role === "teacher" || isSchoolManager(context.role);
  if (!isOwner && !isStaff) throw new Error("You do not have permission to perform this action.");
  if (row.school_id !== context.schoolId)
    throw new Error("You do not have permission to perform this action.");
  await adminUpdate(COLLECTIONS.missedWork, data.id, {
    status: data.status,
    completed_at: data.status === "completed" ? new Date().toISOString() : null,
    reviewed: data.status === "completed",
    reviewed_at: data.status === "completed" ? new Date().toISOString() : null,
  });
  return { ok: true as const };
}
