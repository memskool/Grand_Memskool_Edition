import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth, type AuthedContext } from "@/lib/firebase/require-auth";
import { adminCreate, adminGetById, adminUpdate, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { isSchoolManager } from "@/types/roles";
import { managedSchoolIdFor } from "@/lib/firebase/school-context.server";
import {
  EnrollSchema,
  TeacherAssignSchema,
  SlotSchema,
  SubmitSchema,
  AttendanceSchema,
  MissedWorkAssignSchema,
  MissedWorkProgressSchema,
} from "./schemas";

function schoolOf(context: AuthedContext): string {
  if (!context.schoolId) throw new Error("You are not attached to a school.");
  return context.schoolId;
}

async function requireManager(context: AuthedContext) {
  if (!isSchoolManager(context.role)) {
    const profile = await adminGetById<{ role?: string }>(COLLECTIONS.users, context.userId);
    if (!isSchoolManager(profile?.role as "institution" | "admin" | undefined)) {
      throw new Error("You do not have permission to perform this action.");
    }
  }
  try {
    return await managedSchoolIdFor(context);
  } catch {
    return schoolOf(context);
  }
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

export const enrollStudent = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => EnrollSchema.parse(data))
  .handler(async ({ data, context }) => {
    const schoolId = await requireManager(context);
    const cls = await adminGetById<{
      school_id: string;
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
      student?.school_id === schoolId ||
      (member?.school_id === schoolId &&
        member.status === "approved" &&
        (member.role === "student" || member.role === "teacher"));
    if (!onRoll) {
      const apps = await adminWhere<{ student_id: string; school_id: string; status?: string }>(
        COLLECTIONS.schoolApplications,
        "school_id",
        "==",
        schoolId,
      ).catch(() => []);
      const admitted = apps.some(
        (row) => row.student_id === data.student_id && row.status === "approved",
      );
      if (!admitted) throw new Error("That student is not in your school.");
    }

    const existing = await adminWhere<{ student_id: string; class_id: string; status?: string }>(
      COLLECTIONS.classEnrollments,
      "class_id",
      "==",
      data.class_id,
      [["student_id", "==", data.student_id]],
    );
    if (existing.some((row) => row.status !== "ended")) {
      throw new Error("That student is already in this class.");
    }

    const now = new Date().toISOString();
    const id = await adminCreate(COLLECTIONS.classEnrollments, {
      school_id: schoolId,
      class_id: data.class_id,
      student_id: data.student_id,
      academic_year_id: cls.academic_year_id ?? null,
      academic_period_id: cls.academic_period_id ?? null,
      status: "active",
      started_at: now,
      ended_at: null,
    });
    return { id };
  });

export const endEnrollment = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ enrollment_id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
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
  });

export const assignClassTeacher = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => TeacherAssignSchema.parse(data))
  .handler(async ({ data, context }) => {
    const schoolId = await requireManager(context);
    const cls = await adminGetById<{ school_id: string }>(COLLECTIONS.classes, data.class_id);
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
    if (existing.some((row) => row.status !== "ended")) {
      throw new Error("That teacher is already assigned to this class and subject.");
    }
    const now = new Date().toISOString();
    const id = await adminCreate(COLLECTIONS.classTeacherAssignments, {
      school_id: schoolId,
      ...data,
      status: "active",
      started_at: now,
      ended_at: null,
    });
    return { id };
  });

export const endClassTeacher = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ assignment_id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
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
  });

export const createTimetableSlotSafe = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SlotSchema.parse(data))
  .handler(async ({ data, context }) => {
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
  });

export const submitAssignmentWork = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SubmitSchema.parse(data))
  .handler(async ({ data, context }) => {
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
  });

export const recordLessonAttendance = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AttendanceSchema.parse(data))
  .handler(async ({ data, context }) => {
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
  });

export const assignMissedWork = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => MissedWorkAssignSchema.parse(data))
  .handler(async ({ data, context }) => {
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
  });

export const updateMissedWorkStatus = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => MissedWorkProgressSchema.parse(data))
  .handler(async ({ data, context }) => {
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
  });
