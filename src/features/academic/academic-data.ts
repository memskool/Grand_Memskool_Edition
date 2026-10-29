import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COLLECTIONS,
  createDoc,
  findMany,
  getById,
  patchById,
  where,
  orderBy,
} from "@/lib/firebase/repo";
import { userSchoolId } from "@/lib/firebase/hydrate";
import { classifyFirebase } from "@/lib/errors/app-error";
import { refreshAuthClaims } from "@/features/auth/services/auth.service";
import type {
  AcademicYear,
  AcademicPeriod,
  Curriculum,
  CurriculumTopic,
  AcademicSubject,
  AcademicClass,
  ClassEnrollment,
  ClassTeacherAssignment,
  Lesson,
  LessonMaterial,
  PeriodLabel,
} from "@/types/academic";
import {
  enrollStudent,
  endEnrollment,
  assignClassTeacher,
  endClassTeacher,
  createTimetableSlotSafe,
  submitAssignmentWork,
  recordLessonAttendance,
  assignMissedWork,
  updateMissedWorkStatus,
} from "./academic.functions";
import { listSchoolApplications } from "@/lib/applications.functions";

function nowIso() {
  return new Date().toISOString();
}

export function useAcademicYears(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["academic-years", schoolId],
    enabled: !!schoolId,
    queryFn: () =>
      findMany<AcademicYear>(COLLECTIONS.academicYears, [
        where("school_id", "==", schoolId!),
        orderBy("starts_on", "desc"),
      ]),
  });
}

export function useAcademicPeriods(schoolId: string | undefined, yearId?: string | null) {
  return useQuery({
    queryKey: ["academic-periods", schoolId, yearId ?? "all"],
    enabled: !!schoolId,
    queryFn: async () => {
      const constraints = yearId
        ? [where("academic_year_id", "==", yearId), orderBy("starts_on", "asc")]
        : [where("school_id", "==", schoolId!), orderBy("starts_on", "asc")];
      return findMany<AcademicPeriod>(COLLECTIONS.academicPeriods, constraints);
    },
  });
}

async function writeWithClaimRefresh(write: () => Promise<unknown>) {
  try {
    await write();
  } catch (error) {
    const classified = classifyFirebase(error);
    const msg = classified.message.toLowerCase();
    if (!msg.includes("permission") && !msg.includes("insufficient")) throw classified;
    await refreshAuthClaims();
    try {
      await write();
    } catch (retryError) {
      throw classifyFirebase(retryError);
    }
  }
}

export function useCreateAcademicYear(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; starts_on: string; ends_on: string }) => {
      if (!schoolId) throw new Error("Register your school first.");
      await writeWithClaimRefresh(() =>
        createDoc(COLLECTIONS.academicYears, {
          ...values,
          school_id: schoolId,
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-years", schoolId] }),
  });
}

export function useCreateAcademicPeriod(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      academic_year_id: string;
      name: string;
      label: PeriodLabel;
      starts_on: string;
      ends_on: string;
    }) => {
      if (!schoolId) throw new Error("Register your school first.");
      await writeWithClaimRefresh(() =>
        createDoc(COLLECTIONS.academicPeriods, {
          ...values,
          school_id: schoolId,
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-periods"] }),
  });
}

export function useSetCurrentYear(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (yearId: string) => {
      if (!schoolId) throw new Error("Register your school first.");
      await patchById(COLLECTIONS.schools, schoolId, {
        current_academic_year_id: yearId,
        updated_at: nowIso(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-school"] });
      qc.invalidateQueries({ queryKey: ["academic-years", schoolId] });
    },
  });
}

export function useSetPeriodLabel(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: PeriodLabel) => {
      if (!schoolId) throw new Error("Register your school first.");
      await patchById(COLLECTIONS.schools, schoolId, {
        academic_period_label: label,
        updated_at: nowIso(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-school"] }),
  });
}

export function useCurricula(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["curricula", schoolId],
    enabled: !!schoolId,
    queryFn: () =>
      findMany<Curriculum>(COLLECTIONS.curricula, [
        where("school_id", "==", schoolId!),
        orderBy("name"),
      ]),
  });
}

export function useCurriculumTopics(curriculumId: string | undefined) {
  return useQuery({
    queryKey: ["curriculum-topics", curriculumId],
    enabled: !!curriculumId,
    queryFn: () =>
      findMany<CurriculumTopic>(COLLECTIONS.curriculumTopics, [
        where("curriculum_id", "==", curriculumId!),
        orderBy("sort_order"),
      ]),
  });
}

export function useCreateCurriculum(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; description: string | null }) => {
      if (!schoolId) throw new Error("Register your school first.");
      await writeWithClaimRefresh(() =>
        createDoc(COLLECTIONS.curricula, {
          ...values,
          school_id: schoolId,
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["curricula", schoolId] }),
  });
}

export function useCreateCurriculumLevel(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { curriculum_id: string; name: string; sort_order: number }) => {
      if (!schoolId) throw new Error("Register your school first.");
      await createDoc(COLLECTIONS.curriculumLevels, { ...values, school_id: schoolId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["curriculum-levels"] }),
  });
}

export function useCurriculumLevels(curriculumId: string | undefined) {
  return useQuery({
    queryKey: ["curriculum-levels", curriculumId],
    enabled: !!curriculumId,
    queryFn: () =>
      findMany<{ name: string; sort_order: number; curriculum_id: string }>(
        COLLECTIONS.curriculumLevels,
        [where("curriculum_id", "==", curriculumId!)],
      ),
  });
}

export function useCreateTopic(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      curriculum_id: string;
      name: string;
      subject_id: string | null;
      parent_id: string | null;
      sort_order: number;
    }) => {
      if (!schoolId) throw new Error("Register your school first.");
      await createDoc(COLLECTIONS.curriculumTopics, {
        ...values,
        level_id: null,
        school_id: schoolId,
      });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["curriculum-topics", vars.curriculum_id] }),
  });
}

export function useSchoolSubjects(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-subjects", schoolId],
    enabled: !!schoolId,
    queryFn: () =>
      findMany<AcademicSubject>(COLLECTIONS.subjects, [
        where("school_id", "==", schoolId!),
        orderBy("name"),
      ]),
  });
}

export function useCreateSubject(schoolId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      code: string;
      description: string | null;
      level: string | null;
      curriculum_id: string | null;
    }) => {
      if (!schoolId) throw new Error("Register your school first.");
      await createDoc(COLLECTIONS.subjects, {
        ...values,
        school_id: schoolId,
        status: "active",
        created_by: userId ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-subjects", schoolId] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
}

export function useSchoolClasses(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["academic-classes", schoolId],
    enabled: !!schoolId,
    queryFn: () =>
      findMany<AcademicClass>(COLLECTIONS.classes, [
        where("school_id", "==", schoolId!),
        orderBy("name"),
      ]),
  });
}

export function useCreateAcademicClass(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      room: string | null;
      subject_id: string | null;
      teacher_id: string | null;
      academic_year_id: string | null;
      academic_period_id: string | null;
    }) => {
      if (!schoolId) throw new Error("Register your school first.");
      await createDoc(COLLECTIONS.classes, {
        ...values,
        school_id: schoolId,
        status: "active",
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic-classes", schoolId] });
      qc.invalidateQueries({ queryKey: ["all-classes"] });
    },
  });
}

export function useArchiveClass(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) => {
      await patchById(COLLECTIONS.classes, classId, { status: "archived", updated_at: nowIso() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic-classes", schoolId] });
      qc.invalidateQueries({ queryKey: ["all-classes"] });
    },
  });
}

export function useClassRoster(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-roster", classId],
    enabled: !!classId,
    queryFn: async () => {
      const rows = await findMany<ClassEnrollment>(COLLECTIONS.classEnrollments, [
        where("class_id", "==", classId!),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const student = await getById<{ full_name: string; email: string | null }>(
            COLLECTIONS.users,
            row.student_id,
          );
          return { ...row, student };
        }),
      );
    },
  });
}

export function useClassTeachers(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-teachers", classId],
    enabled: !!classId,
    queryFn: async () => {
      const rows = await findMany<ClassTeacherAssignment>(COLLECTIONS.classTeacherAssignments, [
        where("class_id", "==", classId!),
        where("status", "==", "active"),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const teacher = await getById<{ full_name: string }>(COLLECTIONS.users, row.teacher_id);
          const subject = await getById<{ name: string; code: string }>(
            COLLECTIONS.subjects,
            row.subject_id,
          );
          return { ...row, teacher, subject };
        }),
      );
    },
  });
}

export function useMyTeacherAssignments(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["my-teacher-assignments", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const rows = await findMany<ClassTeacherAssignment>(COLLECTIONS.classTeacherAssignments, [
        where("teacher_id", "==", teacherId!),
        where("status", "==", "active"),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const cls = await getById<AcademicClass>(COLLECTIONS.classes, row.class_id);
          const subject = await getById<{ name: string; code: string }>(
            COLLECTIONS.subjects,
            row.subject_id,
          );
          return { ...row, class: cls, subject };
        }),
      );
    },
  });
}

export function useLessonsForTeacher(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-lessons", teacherId],
    enabled: !!teacherId,
    queryFn: () =>
      findMany<Lesson>(COLLECTIONS.lessons, [
        where("teacher_id", "==", teacherId!),
        orderBy("starts_at", "asc"),
      ]),
  });
}

export function useLessonsForClass(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-lessons", classId],
    enabled: !!classId,
    queryFn: () =>
      findMany<Lesson>(COLLECTIONS.lessons, [
        where("class_id", "==", classId!),
        orderBy("starts_at", "asc"),
      ]),
  });
}

export function useLessonMaterials(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["lesson-materials", lessonId],
    enabled: !!lessonId,
    queryFn: () =>
      findMany<LessonMaterial>(COLLECTIONS.lessonMaterials, [
        where("lesson_id", "==", lessonId!),
        orderBy("created_at", "asc"),
      ]),
  });
}

export function useCreateLesson(teacherId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      class_id: string;
      subject_id: string | null;
      academic_period_id: string | null;
      title: string;
      description: string | null;
      starts_at: string | null;
      duration_minutes: number | null;
      status: Lesson["status"];
      curriculum_topic_id: string | null;
    }) => {
      if (!teacherId) throw new Error("Sign in as a teacher first.");
      const schoolId = await userSchoolId(teacherId);
      if (!schoolId) throw new Error("You are not attached to a school.");
      await createDoc(COLLECTIONS.lessons, {
        ...values,
        school_id: schoolId,
        teacher_id: teacherId,
        timetable_slot_id: null,
        classroom_session_id: null,
        recording_ref: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-lessons"] }),
  });
}

export function useAddLessonMaterial(teacherId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      lesson_id: string;
      title: string;
      kind: LessonMaterial["kind"];
      url: string | null;
      storage_path: string | null;
      file_name: string | null;
      mime_type: string | null;
    }) => {
      if (!teacherId) throw new Error("Sign in first.");
      const schoolId = await userSchoolId(teacherId);
      await createDoc(COLLECTIONS.lessonMaterials, {
        ...values,
        school_id: schoolId,
        created_by: teacherId,
        created_at: nowIso(),
        locker_ref: null,
      });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["lesson-materials", vars.lesson_id] }),
  });
}

export function useEnrollStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { class_id: string; student_id: string }) => {
      try {
        const raw = await enrollStudent({ data: input });
        const id = unwrapNestedId(raw);
        if (id) return { id };
      } catch (error) {
        console.error("[enrol] server enroll failed:", error);
      }
      const cls = await getById<{
        school_id: string;
        academic_year_id?: string | null;
        academic_period_id?: string | null;
      }>(COLLECTIONS.classes, input.class_id);
      if (!cls) throw new Error("That class was not found.");
      try {
        const id = await createDoc(COLLECTIONS.classEnrollments, {
          school_id: cls.school_id,
          class_id: input.class_id,
          student_id: input.student_id,
          academic_year_id: cls.academic_year_id ?? null,
          academic_period_id: cls.academic_period_id ?? null,
          status: "active",
          started_at: nowIso(),
          ended_at: null,
        });
        return { id };
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["class-roster", vars.class_id] }),
  });
}

export function useEndEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { enrollment_id: string; class_id: string }) => {
      try {
        return await endEnrollment({ data: { enrollment_id: input.enrollment_id } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["class-roster", vars.class_id] }),
  });
}

export function useAssignTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { class_id: string; subject_id: string; teacher_id: string }) => {
      try {
        return await assignClassTeacher({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["class-teachers", vars.class_id] }),
  });
}

export function useEndTeacherAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { assignment_id: string; class_id: string }) => {
      try {
        return await endClassTeacher({ data: { assignment_id: input.assignment_id } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["class-teachers", vars.class_id] }),
  });
}

export function useCreateSlotSafe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      class_id: string;
      subject_id: string | null;
      teacher_id: string | null;
      academic_period_id: string | null;
      day_of_week: number;
      start_time: string;
      end_time: string;
      room: string | null;
    }) => {
      try {
        return await createTimetableSlotSafe({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-timetable"] }),
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      assignment_id: string;
      text_body: string | null;
      storage_paths: string[];
    }) => {
      try {
        return await submitAssignmentWork({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
      qc.invalidateQueries({ queryKey: ["pending-grading"] });
    },
  });
}

export function useRecordAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      lesson_id: string;
      marks: Array<{ student_id: string; status: "present" | "absent" | "late" | "excused" }>;
    }) => {
      try {
        return await recordLessonAttendance({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

export function useAssignMissedWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      student_id: string;
      lesson_id: string | null;
      class_id: string | null;
      subject_id: string | null;
      assignment_id: string | null;
      material_id: string | null;
      title: string;
    }) => {
      try {
        return await assignMissedWork({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missed-work"] }),
  });
}

export function useUpdateMissedWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "pending" | "in_progress" | "completed" }) => {
      try {
        return await updateMissedWorkStatus({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missed-work"] }),
  });
}

type DirectoryPerson = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
};

function unwrapNestedId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["id"] === "string" && obj["id"]) return obj["id"];
  for (const key of ["data", "result", "payload", "value"]) {
    const inner = obj[key];
    if (inner && typeof inner === "object") {
      const nested = inner as Record<string, unknown>;
      if (typeof nested["id"] === "string" && nested["id"]) return nested["id"];
    }
  }
  return null;
}

function unwrapRows<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "result", "payload", "value"]) {
      const inner = obj[key];
      if (Array.isArray(inner)) return inner as T[];
    }
  }
  return [];
}

async function listSchoolPeople(
  schoolId: string,
  role: "student" | "teacher" | "parent",
): Promise<DirectoryPerson[]> {
  const byId = new Map<string, DirectoryPerson>();
  const add = (id: string, name?: string | null, email?: string | null) => {
    if (!id || byId.has(id)) return;
    byId.set(id, {
      id,
      full_name: (name && name.trim()) || email || (role === "teacher" ? "Teacher" : "Student"),
      email: email ?? null,
      role,
    });
  };

  try {
    const members = await findMany<{ user_id?: string; role: string; status: string }>(
      COLLECTIONS.schoolMembers,
      [where("school_id", "==", schoolId)],
    );
    for (const member of members) {
      if (member.role !== role || (member.status !== "approved" && member.status !== "owner")) {
        continue;
      }
      const userId = member.user_id || member.id;
      const user = await getById<{ full_name?: string; email?: string | null }>(
        COLLECTIONS.users,
        userId,
      );
      add(userId, user?.full_name, user?.email);
    }
  } catch (error) {
    console.error(`[school-${role}s] members list failed:`, error);
  }

  if (role === "student") {
    try {
      const apps = unwrapRows<{
        student_id: string;
        applicant_name?: string;
        email?: string | null;
        status: string;
      }>(await listSchoolApplications());
      for (const app of apps) {
        if (app.status === "approved") add(app.student_id, app.applicant_name, app.email);
      }
    } catch (error) {
      console.error("[school-students] applications list failed:", error);
    }
    try {
      const apps = await findMany<{
        student_id: string;
        applicant_name?: string;
        email?: string | null;
        status: string;
      }>(COLLECTIONS.schoolApplications, [where("school_id", "==", schoolId)]);
      for (const app of apps) {
        if (app.status === "approved") add(app.student_id, app.applicant_name, app.email);
      }
    } catch (error) {
      console.error("[school-students] applications client list failed:", error);
    }
  }

  try {
    const users = await findMany<{ full_name: string; email: string | null; role: string }>(
      COLLECTIONS.users,
      [where("school_id", "==", schoolId), where("role", "==", role)],
    );
    for (const user of users) add(user.id, user.full_name, user.email);
  } catch (error) {
    console.error(`[school-${role}s] users list failed:`, error);
  }

  return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function useSchoolStudents(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-students", schoolId],
    enabled: !!schoolId,
    queryFn: () => listSchoolPeople(schoolId!, "student"),
  });
}

export function useSchoolParents(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-parents", schoolId],
    enabled: !!schoolId,
    queryFn: () =>
      findMany<{ full_name: string; email: string | null; role: string }>(COLLECTIONS.users, [
        where("school_id", "==", schoolId!),
        where("role", "==", "parent"),
      ]),
  });
}

export function useSchoolTeachers(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-teachers", schoolId],
    enabled: !!schoolId,
    queryFn: () => listSchoolPeople(schoolId!, "teacher"),
  });
}

export { classifyFirebase };
