import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { COLLECTIONS, findMany, getById, where, orderBy } from "@/lib/firebase/repo";
import { userSchoolId } from "@/lib/firebase/hydrate";
import { classifyFirebase } from "@/lib/errors/app-error";
import { createAssignment, deleteAssignment } from "@/features/academic/academic.functions";

export function useTeacherAssignments(classIds: string[]) {
  const key = [...classIds].sort().join(",");
  return useQuery({
    queryKey: ["teacher-assignments", key],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const schoolId = await userSchoolId();
      if (!schoolId) return [];
      const rows = await findMany<{
        title: string;
        description: string | null;
        due_at: string | null;
        points: number;
        class_id: string;
      }>(COLLECTIONS.assignments, [
        where("school_id", "==", schoolId),
        where("class_id", "in", classIds.slice(0, 30)),
        orderBy("due_at", "asc"),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const cls = await getById<{ name: string }>(COLLECTIONS.classes, row.class_id);
          return { ...row, class: cls ? { name: cls.name } : null };
        }),
      );
    },
  });
}

export function useCreateAssignment(_teacherId: string | undefined, classIds: string[]) {
  const qc = useQueryClient();
  const key = [...classIds].sort().join(",");
  return useMutation({
    // Server-side: enforces the class-teacher check and notifies every enrolled learner.
    mutationFn: async (values: {
      class_id: string;
      title: string;
      description: string | null;
      due_at: string | null;
      points: number;
    }) => {
      try {
        return await createAssignment({ data: values });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-assignments", key] });
      void qc.invalidateQueries({ queryKey: ["my-assignments"] });
    },
  });
}

export function useDeleteAssignment(classIds: string[]) {
  const qc = useQueryClient();
  const key = [...classIds].sort().join(",");
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await deleteAssignment({ data: { assignment_id: id } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-assignments", key] }),
  });
}
