import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { refreshAiInsights } from "@/lib/learning-memory.functions";
import { COLLECTIONS, findMany, getById, patchById, where, orderBy } from "@/lib/firebase/repo";

export type LearningProfile = {
  student_id: string;
  summary: string | null;
  strong_topics: string[];
  weak_topics: string[];
  learning_style: string | null;
  recent_pattern: string | null;
  focus_topic: string | null;
  data_points: number;
  generated_at: string;
};

export type AiInsight = {
  id: string;
  title: string;
  body: string;
  action_label: string | null;
  action_link: string | null;
  created_at: string;
};

export function useLearningProfile(studentId: string | undefined) {
  return useQuery({
    queryKey: ["learning-profile", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<LearningProfile | null> => {
      const byId = await getById<LearningProfile>(COLLECTIONS.learningProfiles, studentId!);
      if (byId) return { ...byId, student_id: studentId! };
      const row = await findMany<LearningProfile>(COLLECTIONS.learningProfiles, [
        where("student_id", "==", studentId!),
      ]);
      return row[0] ?? null;
    },
  });
}

export function useAiInsights(userId: string | undefined, scope: "student" | "teacher") {
  return useQuery({
    queryKey: ["ai-insights", userId, scope],
    enabled: !!userId,
    queryFn: async (): Promise<AiInsight[]> => {
      return findMany<AiInsight>(COLLECTIONS.aiInsights, [
        where("user_id", "==", userId!),
        where("scope", "==", scope),
        where("dismissed", "==", false),
        orderBy("created_at", "desc"),
      ]);
    },
  });
}

export function useRefreshAiInsights(scope: "student" | "teacher") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => refreshAiInsights({ data: { scope } }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["ai-insights"] });
      qc.invalidateQueries({ queryKey: ["learning-profile"] });
      toast.success(
        result.dataPoints === 0
          ? "Not enough activity yet — your learning memory starts once you have classwork."
          : "Learning memory updated.",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't update your learning memory."),
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await patchById(COLLECTIONS.aiInsights, id, { dismissed: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-insights"] }),
  });
}
