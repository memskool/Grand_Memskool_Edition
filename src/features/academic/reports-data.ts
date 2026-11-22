import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { classifyFirebase } from "@/lib/errors/app-error";
import {
  bulkImportPeople,
  getClassGradebook,
  getStudentReportCard,
  listMyChildrenForReports,
} from "./reports.functions";
import type { ImportRole, ImportRow } from "./report-policy";

export type GradebookData = Awaited<ReturnType<typeof getClassGradebook>>;
export type ReportCardData = Awaited<ReturnType<typeof getStudentReportCard>>;
export type ImportResultRow = Awaited<ReturnType<typeof bulkImportPeople>>["results"][number];

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw classifyFirebase(error);
  }
}

export function useClassGradebook(classId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ["gradebook", classId, periodId],
    enabled: !!classId,
    queryFn: () =>
      call(() => getClassGradebook({ data: { class_id: classId!, period_id: periodId } })),
  });
}

export function useStudentReportCard(studentId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ["report-card", studentId, periodId],
    enabled: !!studentId,
    queryFn: () =>
      call(() => getStudentReportCard({ data: { student_id: studentId!, period_id: periodId } })),
  });
}

export function useMyChildrenForReports(enabled: boolean) {
  return useQuery({
    queryKey: ["report-children"],
    enabled,
    queryFn: () => call(() => listMyChildrenForReports()),
  });
}

const IMPORT_BATCH = 25;

/** Sends a long list in batches so each request stays well inside the server time limit. */
export function useBulkImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      role: ImportRole;
      rows: ImportRow[];
      onProgress?: (done: number, total: number) => void;
    }) => {
      const results: ImportResultRow[] = [];
      for (let i = 0; i < input.rows.length; i += IMPORT_BATCH) {
        const batch = input.rows.slice(i, i + IMPORT_BATCH);
        const res = await call(() => bulkImportPeople({ data: { role: input.role, rows: batch } }));
        results.push(...res.results);
        input.onProgress?.(Math.min(i + IMPORT_BATCH, input.rows.length), input.rows.length);
      }
      return results;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["school-members"] });
      void qc.invalidateQueries({ queryKey: ["class-roster"] });
      void qc.invalidateQueries({ queryKey: ["school-overview"] });
    },
  });
}
