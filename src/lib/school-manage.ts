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

export function useSchoolClasses(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-classes", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const rows = await findMany<{
        name: string;
        room: string | null;
        school_id: string;
        subject_id: string | null;
        teacher_id: string | null;
      }>(COLLECTIONS.classes, [where("school_id", "==", schoolId!), orderBy("name")]);
      return Promise.all(
        rows.map(async (row) => {
          const subject = row.subject_id
            ? await getById<{ name: string; code: string }>(COLLECTIONS.subjects, row.subject_id)
            : null;
          const teacher = row.teacher_id
            ? await getById<{ full_name: string }>(COLLECTIONS.users, row.teacher_id)
            : null;
          return {
            ...row,
            subject: subject ? { name: subject.name, code: subject.code } : null,
            teacher: teacher ? { id: teacher.id, full_name: teacher.full_name } : null,
          };
        }),
      );
    },
  });
}

export function useCreateSchoolClass(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      subject_id: string | null;
      teacher_id: string | null;
      room: string | null;
    }) => {
      if (!schoolId) throw new Error("Register your school first");
      await createDoc(COLLECTIONS.classes, {
        ...values,
        school_id: schoolId,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-classes", schoolId] });
      qc.invalidateQueries({ queryKey: ["weekly-timetable"] });
    },
  });
}

export function useAssignTeacher(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, teacherId }: { classId: string; teacherId: string | null }) => {
      await patchById(COLLECTIONS.classes, classId, { teacher_id: teacherId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-classes", schoolId] }),
  });
}

export function useDeleteSchoolClass(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) => {
      await patchById(COLLECTIONS.classes, classId, {
        status: "archived",
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-classes", schoolId] }),
  });
}

export function useClassEnrollments(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-enrollments", classId],
    enabled: !!classId,
    queryFn: async () => {
      const rows = await findMany<{ student_id: string }>(COLLECTIONS.classEnrollments, [
        where("class_id", "==", classId!),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const student = await getById<{ full_name: string; email: string | null }>(
            COLLECTIONS.users,
            row.student_id,
          );
          return {
            ...row,
            student: student
              ? { id: student.id, full_name: student.full_name, email: student.email }
              : null,
          };
        }),
      );
    },
  });
}

export function useEnrollStudent(classId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      if (!classId) throw new Error("Pick a class first");
      const cls = await getById<{ school_id: string }>(COLLECTIONS.classes, classId);
      await createDoc(COLLECTIONS.classEnrollments, {
        class_id: classId,
        student_id: studentId,
        school_id: cls?.school_id ?? null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-enrollments", classId] }),
  });
}

export function useUnenrollStudent(classId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await patchById(COLLECTIONS.classEnrollments, id, {
        status: "ended",
        ended_at: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-enrollments", classId] }),
  });
}
