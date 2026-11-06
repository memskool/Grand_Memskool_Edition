import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { z } from "zod";
import {
  EnrollSchema,
  TeacherAssignSchema,
  SlotSchema,
  SubmitSchema,
  AttendanceSchema,
  MissedWorkAssignSchema,
  MissedWorkProgressSchema,
} from "./schemas";

export const enrollStudent = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => EnrollSchema.parse(data))
  .handler(async (opts) => {
    const { enrollStudentHandler } = await import("./academic.server");
    return enrollStudentHandler(opts);
  });

export const endEnrollment = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ enrollment_id: z.string().min(1) }).parse(data))
  .handler(async (opts) => {
    const { endEnrollmentHandler } = await import("./academic.server");
    return endEnrollmentHandler(opts);
  });

export const assignClassTeacher = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => TeacherAssignSchema.parse(data))
  .handler(async (opts) => {
    const { assignClassTeacherHandler } = await import("./academic.server");
    return assignClassTeacherHandler(opts);
  });

export const listMyTeachingClasses = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async (opts) => {
    const { listMyTeachingClassesHandler } = await import("./academic.server");
    return listMyTeachingClassesHandler(opts);
  });

export const listMyEnrolledClasses = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async (opts) => {
    const { listMyEnrolledClassesHandler } = await import("./academic.server");
    return listMyEnrolledClassesHandler(opts);
  });

export const listClassRoster = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ class_id: z.string().min(1) }).parse(data))
  .handler(async (opts) => {
    const { listClassRosterHandler } = await import("./academic.server");
    return listClassRosterHandler(opts);
  });

export const endClassTeacher = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ assignment_id: z.string().min(1) }).parse(data))
  .handler(async (opts) => {
    const { endClassTeacherHandler } = await import("./academic.server");
    return endClassTeacherHandler(opts);
  });

export const createTimetableSlotSafe = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SlotSchema.parse(data))
  .handler(async (opts) => {
    const { createTimetableSlotSafeHandler } = await import("./academic.server");
    return createTimetableSlotSafeHandler(opts);
  });

export const submitAssignmentWork = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SubmitSchema.parse(data))
  .handler(async (opts) => {
    const { submitAssignmentWorkHandler } = await import("./academic.server");
    return submitAssignmentWorkHandler(opts);
  });

export const recordLessonAttendance = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AttendanceSchema.parse(data))
  .handler(async (opts) => {
    const { recordLessonAttendanceHandler } = await import("./academic.server");
    return recordLessonAttendanceHandler(opts);
  });

export const assignMissedWork = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => MissedWorkAssignSchema.parse(data))
  .handler(async (opts) => {
    const { assignMissedWorkHandler } = await import("./academic.server");
    return assignMissedWorkHandler(opts);
  });

export const updateMissedWorkStatus = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => MissedWorkProgressSchema.parse(data))
  .handler(async (opts) => {
    const { updateMissedWorkStatusHandler } = await import("./academic.server");
    return updateMissedWorkStatusHandler(opts);
  });
