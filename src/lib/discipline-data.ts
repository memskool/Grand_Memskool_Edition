import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { triggerNotificationDelivery } from "@/lib/notifications-data";

export type DisciplinaryAction = {
  id: string;
  student_id: string;
  issued_by: string | null;
  kind: string;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  created_at: string;
  student: { full_name: string } | null;
};

const SELECT =
  "id, student_id, issued_by, kind, reason, starts_at, ends_at, active, created_at, student:profiles!disciplinary_actions_student_id_fkey(full_name)";

export function isActiveSuspension(a: DisciplinaryAction) {
  if (a.kind !== "suspension" || !a.active) return false;
  const now = Date.now();
  return (
    new Date(a.starts_at).getTime() <= now && (!a.ends_at || new Date(a.ends_at).getTime() > now)
  );
}

/** Actions issued to the signed-in student (or any user). */
export function useMyDisciplinaryActions(userId?: string) {
  return useQuery({
    queryKey: ["discipline", "mine", userId],
    enabled: !!userId,
    queryFn: async (): Promise<DisciplinaryAction[]> => {
      const { data, error } = await supabase
        .from("disciplinary_actions")
        .select(SELECT)
        .eq("student_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DisciplinaryAction[];
    },
  });
}

/** True while the signed-in student is serving a suspension. */
export function useSuspensionStatus(userId?: string) {
  const query = useMyDisciplinaryActions(userId);
  const active = (query.data ?? []).find(isActiveSuspension) ?? null;
  return { loading: query.isLoading, suspension: active, suspended: !!active };
}

export function useAllDisciplinaryActions(enabled: boolean) {
  return useQuery({
    queryKey: ["discipline", "all"],
    enabled,
    queryFn: async (): Promise<DisciplinaryAction[]> => {
      const { data, error } = await supabase
        .from("disciplinary_actions")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DisciplinaryAction[];
    },
  });
}

export type StudentOption = { id: string; full_name: string };

export function useStudentDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ["student-directory"],
    enabled,
    queryFn: async (): Promise<StudentOption[]> => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (rolesError) throw rolesError;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as StudentOption[];
    },
  });
}

export type NewAction = {
  student_id: string;
  kind: "warning" | "suspension";
  reason: string;
  days: number | null;
};

export function useIssueAction(issuedBy?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ student_id, kind, reason, days }: NewAction) => {
      const endsAt =
        kind === "suspension" && days
          ? new Date(Date.now() + days * 86_400_000).toISOString()
          : null;
      const { error } = await supabase.from("disciplinary_actions").insert({
        student_id,
        issued_by: issuedBy!,
        kind,
        reason,
        ends_at: endsAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["discipline"] });
      triggerNotificationDelivery();
    },
  });
}

export function useLiftAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("disciplinary_actions")
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["discipline"] });
    },
  });
}
