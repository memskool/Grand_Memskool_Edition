import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Classes that belong to a school the institution owns. */
export function useSchoolClasses(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-classes", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, room, school_id, subject:subjects(name, code), teacher:profiles(id, full_name)")
        .eq("school_id", schoolId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
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
      const { error } = await supabase.from("classes").insert({ ...values, school_id: schoolId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-classes", schoolId] });
      qc.invalidateQueries({ queryKey: ["weekly-timetable"] });
    },
  });
}

/** Assign (or unassign) the teacher who runs a class. */
export function useAssignTeacher(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, teacherId }: { classId: string; teacherId: string | null }) => {
      const { error } = await supabase
        .from("classes")
        .update({ teacher_id: teacherId })
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-classes", schoolId] }),
  });
}

export function useDeleteSchoolClass(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-classes", schoolId] }),
  });
}

/** Students currently enrolled in a class. */
export function useClassEnrollments(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-enrollments", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("id, student_id, student:profiles(id, full_name, email)")
        .eq("class_id", classId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEnrollStudent(classId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      if (!classId) throw new Error("Pick a class first");
      const { error } = await supabase
        .from("class_enrollments")
        .insert({ class_id: classId, student_id: studentId });
      if (error) {
        throw new Error(
          error.code === "23505" ? "That learner is already in this class." : error.message,
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-enrollments", classId] }),
  });
}

export function useUnenrollStudent(classId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_enrollments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-enrollments", classId] }),
  });
}
