import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { triggerNotificationDelivery } from "@/lib/notifications-data";
import {
  COLLECTIONS,
  createDoc,
  findMany,
  patchById,
  where,
  orderBy,
  limit,
} from "@/lib/firebase/repo";
import { attachNamedUser, userSchoolId } from "@/lib/firebase/hydrate";

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

export function isActiveSuspension(a: DisciplinaryAction) {
  if (a.kind !== "suspension" || !a.active) return false;
  const now = Date.now();
  return (
    new Date(a.starts_at).getTime() <= now && (!a.ends_at || new Date(a.ends_at).getTime() > now)
  );
}

export function useMyDisciplinaryActions(userId?: string) {
  return useQuery({
    queryKey: ["discipline", "mine", userId],
    enabled: !!userId,
    queryFn: async (): Promise<DisciplinaryAction[]> => {
      const rows = await findMany<Omit<DisciplinaryAction, "student">>(
        COLLECTIONS.disciplinaryActions,
        [where("student_id", "==", userId!), orderBy("created_at", "desc")],
      );
      return Promise.all(
        rows.map((row) => attachNamedUser(row, row.student_id, "student")),
      ) as Promise<DisciplinaryAction[]>;
    },
  });
}

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
      const schoolId = await userSchoolId();
      const rows = await findMany<Omit<DisciplinaryAction, "student">>(
        COLLECTIONS.disciplinaryActions,
        schoolId
          ? [where("school_id", "==", schoolId), orderBy("created_at", "desc"), limit(100)]
          : [orderBy("created_at", "desc"), limit(100)],
      );
      return Promise.all(
        rows.map((row) => attachNamedUser(row, row.student_id, "student")),
      ) as Promise<DisciplinaryAction[]>;
    },
  });
}

export type StudentOption = { id: string; full_name: string };

export function useStudentDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ["student-directory"],
    enabled,
    queryFn: async (): Promise<StudentOption[]> => {
      const schoolId = await userSchoolId();
      const rows = await findMany<{ full_name: string; role: string }>(
        COLLECTIONS.users,
        schoolId
          ? [where("school_id", "==", schoolId), where("role", "==", "student")]
          : [where("role", "==", "student")],
      );
      return rows
        .map((r) => ({ id: r.id, full_name: r.full_name }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
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
      const schoolId = await userSchoolId(issuedBy);
      const now = new Date().toISOString();
      await createDoc(COLLECTIONS.disciplinaryActions, {
        student_id,
        issued_by: issuedBy!,
        kind,
        reason,
        starts_at: now,
        ends_at: endsAt,
        active: true,
        school_id: schoolId,
        created_at: now,
      });
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
      await patchById(COLLECTIONS.disciplinaryActions, id, { active: false });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["discipline"] });
    },
  });
}
