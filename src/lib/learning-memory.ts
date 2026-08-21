import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { refreshAiInsights } from "@/lib/learning-memory.functions";

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

/** The student's AI learning memory — strengths, weak areas and study style. */
export function useLearningProfile(studentId: string | undefined) {
  return useQuery({
    queryKey: ["learning-profile", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<LearningProfile | null> => {
      const { data, error } = await supabase
        .from("learning_profiles")
        .select("*")
        .eq("student_id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return (data as LearningProfile | null) ?? null;
    },
  });
}

export function useAiInsights(userId: string | undefined, scope: "student" | "teacher") {
  return useQuery({
    queryKey: ["ai-insights", userId, scope],
    enabled: !!userId,
    queryFn: async (): Promise<AiInsight[]> => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("id, title, body, action_label, action_link, created_at")
        .eq("user_id", userId!)
        .eq("scope", scope)
        .eq("dismissed", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiInsight[];
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
      const { error } = await supabase.from("ai_insights").update({ dismissed: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-insights"] }),
  });
}
