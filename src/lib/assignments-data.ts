import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Assignments across every class a teacher runs. */
export function useTeacherAssignments(classIds: string[]) {
  const key = [...classIds].sort().join(",");
  return useQuery({
    queryKey: ["teacher-assignments", key],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, description, due_at, points, class_id, class:classes(name)")
        .in("class_id", classIds)
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
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
      const { error } = await supabase
        .from("assignments")
        .insert({ ...values, created_by: teacherId ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-assignments", key] }),
  });
}

export function useDeleteAssignment(classIds: string[]) {
  const qc = useQueryClient();
  const key = [...classIds].sort().join(",");
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-assignments", key] }),
  });
}
