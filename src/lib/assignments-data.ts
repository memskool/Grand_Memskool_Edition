import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COLLECTIONS,
  createDoc,
  findMany,
  getById,
  removeById,
  where,
  orderBy,
} from "@/lib/firebase/repo";

export function useTeacherAssignments(classIds: string[]) {
  const key = [...classIds].sort().join(",");
  return useQuery({
    queryKey: ["teacher-assignments", key],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const rows = await findMany<{
        title: string;
        description: string | null;
        due_at: string | null;
        points: number;
        class_id: string;
      }>(COLLECTIONS.assignments, [
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

export function useCreateAssignment(teacherId: string | undefined, classIds: string[]) {
  const qc = useQueryClient();
  const key = [...classIds].sort().join(",");
  return useMutation({
    mutationFn: async (values: {
      class_id: string;
      title: string;
      description: string | null;
      due_at: string | null;
      points: number;
    }) => {
      const cls = await getById<{ school_id: string }>(COLLECTIONS.classes, values.class_id);
      await createDoc(COLLECTIONS.assignments, {
        ...values,
        created_by: teacherId ?? null,
        teacher_id: teacherId ?? null,
        school_id: cls?.school_id ?? null,
        status: "published",
        allow_resubmit: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-assignments", key] }),
  });
}

export function useDeleteAssignment(classIds: string[]) {
  const qc = useQueryClient();
  const key = [...classIds].sort().join(",");
  return useMutation({
    mutationFn: async (id: string) => {
      await removeById(COLLECTIONS.assignments, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-assignments", key] }),
  });
}
