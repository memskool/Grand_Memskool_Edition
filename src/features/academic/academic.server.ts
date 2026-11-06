import "@tanstack/react-start/server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import {
  adminCreate,
  adminGetById,
  adminSet,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { adminAuth } from "@/lib/firebase/admin.server";
import { toClientJson } from "@/lib/firebase/plain-data";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { isSchoolManager } from "@/types/roles";
import { requireSchoolManagerContext } from "@/lib/firebase/school-context.server";
import { classEnrollmentId, classTeacherAssignmentId } from "./ids";

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

function requireStaff(context: AuthedContext) {
  if (context.role !== "teacher" && !isSchoolManager(context.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  if (context.role === "teacher" && !context.approved) {
    throw new Error("Your school has not approved your teacher account yet.");
  }
  return schoolOf(context);
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
  const schoolId = requireStaff(context);
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

  const existing = prior[0];
  if (existing) {
    if (assignment.allow_resubmit === false) {
      throw new Error("Resubmission is not allowed for this assignment.");
    }
    await adminUpdate(COLLECTIONS.submissions, existing.id, payload);
    return { id: existing.id, status, late };
  }
  const id = await adminCreate(COLLECTIONS.submissions, payload);
  return { id, status, late };
}

export async function recordLessonAttendanceHandler({
  data,
  context,
}: DataCtx<{ lesson_id: string; marks: Array<{ student_id: string; status: string }> }>) {
  const schoolId = requireStaff(context);
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
  const schoolId = requireStaff(context);
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
