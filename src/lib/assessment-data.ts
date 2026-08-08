import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuestionKind = "multiple_choice" | "short_answer";

export type AssessmentQuestion = {
  id: string;
  assessment_id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  /** Only ever populated for the teacher who owns the assessment. */
  correct_answer?: string | null;
  points: number;
};

export type Assessment = {
  id: string;
  title: string;
  description: string | null;
  class_id: string | null;
  subject_id: string | null;
  created_by: string;
  time_limit_minutes: number;
  passing_score: number;
  total_points: number;
  published: boolean;
  created_at: string;
  class?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
};

export type AssessmentSubmission = {
  id: string;
  assessment_id: string;
  student_id: string;
  answers: Record<string, string>;
  auto_score: number;
  manual_score: number | null;
  total_points: number;
  passed: boolean | null;
  status: "in_progress" | "submitted" | "graded";
  started_at: string;
  submitted_at: string | null;
  assessment?: Assessment | null;
  student?: { id: string; full_name: string } | null;
};

const ASSESSMENT_SELECT =
  "id, title, description, class_id, subject_id, created_by, time_limit_minutes, passing_score, total_points, published, created_at, class:classes(id, name), subject:subjects(id, name)";

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function useTeacherAssessments(userId?: string) {
  return useQuery({
    queryKey: ["assessments", "teacher", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select(ASSESSMENT_SELECT)
        .eq("created_by", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Assessment[];
    },
  });
}

export function useAvailableAssessments(studentId?: string) {
  return useQuery({
    queryKey: ["assessments", "available", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select(ASSESSMENT_SELECT)
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Assessment[];
    },
  });
}

export function useAssessment(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select(ASSESSMENT_SELECT)
        .eq("id", assessmentId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Assessment | null;
    },
  });
}

/** Student-facing read: the answer key column is not selectable by learners. */
export function useAssessmentQuestions(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment-questions", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_questions")
        .select("id, assessment_id, position, kind, prompt, options, points")
        .eq("assessment_id", assessmentId!)
        .order("position");
      if (error) throw error;
      return (data ?? []).map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
      })) as AssessmentQuestion[];
    },
  });
}

/** Owner-only read (teacher/admin) that includes the answer key. */
export function useAssessmentAnswerKey(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment-questions", "owner", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_assessment_questions", {
        _assessment_id: assessmentId!,
      });
      if (error) throw error;
      return (data ?? []).map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
      })) as AssessmentQuestion[];
    },
  });
}


export function useMyAttempts(studentId?: string) {
  return useQuery({
    queryKey: ["assessment-submissions", "student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_submissions")
        .select(`*, assessment:assessments(${ASSESSMENT_SELECT})`)
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssessmentSubmission[];
    },
  });
}

export function useAssessmentResults(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment-submissions", "assessment", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_submissions")
        .select("*, student:profiles(id, full_name)")
        .eq("assessment_id", assessmentId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssessmentSubmission[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export type DraftQuestion = {
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_answer: string;
  points: number;
};

export function useCreateAssessment(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      class_id: string | null;
      subject_id: string | null;
      time_limit_minutes: number;
      passing_score: number;
      published: boolean;
      questions: DraftQuestion[];
    }) => {
      const total = input.questions.reduce((sum, q) => sum + (q.points || 0), 0);
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          title: input.title,
          description: input.description || null,
          class_id: input.class_id,
          subject_id: input.subject_id,
          created_by: userId!,
          time_limit_minutes: input.time_limit_minutes,
          passing_score: input.passing_score,
          total_points: total,
          published: input.published,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (input.questions.length) {
        const { error: qErr } = await supabase.from("assessment_questions").insert(
          input.questions.map((q, i) => ({
            assessment_id: data.id,
            position: i,
            kind: q.kind,
            prompt: q.prompt,
            options: q.kind === "multiple_choice" ? q.options : [],
            correct_answer: q.correct_answer || null,
            points: q.points,
          })),
        );
        if (qErr) throw qErr;
      }
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
    },
  });
}

export function useTogglePublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await supabase.from("assessments").update({ published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });
}

export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });
}

/**
 * Grading happens server-side (see the submit_assessment database function) so
 * answer keys never reach the browser. Kept only for teacher-side previews
 * where the answer key was explicitly loaded via useAssessmentAnswerKey.
 */
export function gradeAnswers(questions: AssessmentQuestion[], answers: Record<string, string>) {
  let autoScore = 0;
  let autoPoints = 0;
  let manualPending = false;

  for (const q of questions) {
    if (q.kind === "multiple_choice") {
      autoPoints += q.points;
      const given = (answers[q.id] ?? "").trim();
      if (given && given === (q.correct_answer ?? "").trim()) autoScore += q.points;
    } else {
      manualPending = true;
    }
  }
  return { autoScore, autoPoints, manualPending };
}

export function useStartAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assessmentId, studentId }: { assessmentId: string; studentId: string }) => {
      const { data: existing } = await supabase
        .from("assessment_submissions")
        .select("*")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (existing) return existing as unknown as AssessmentSubmission;

      const { data, error } = await supabase
        .from("assessment_submissions")
        .insert({ assessment_id: assessmentId, student_id: studentId })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as AssessmentSubmission;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-submissions"] }),
  });
}

export function useSubmitAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      submissionId,
      answers,
    }: {
      submissionId: string;
      answers: Record<string, string>;
    }) => {
      const { data, error } = await supabase.rpc("submit_assessment", {
        _submission_id: submissionId,
        _answers: answers,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { auto_score: number; total_points: number; manual_pending: boolean }
        | undefined;
      return {
        autoScore: Number(row?.auto_score ?? 0),
        totalPoints: Number(row?.total_points ?? 0),
        manualPending: !!row?.manual_pending,
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-submissions"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export type TrendPoint = { label: string; percent: number; subject: string };

export function usePerformanceTrend(studentId?: string) {
  return useQuery({
    queryKey: ["performance-trend", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<TrendPoint[]> => {
      const { data, error } = await supabase
        .from("assessment_submissions")
        .select(
          "id, auto_score, manual_score, total_points, submitted_at, assessment:assessments(title, subject:subjects(name))",
        )
        .eq("student_id", studentId!)
        .not("submitted_at", "is", null)
        .order("submitted_at");
      if (error) throw error;

      return (data ?? []).map((row) => {
        const a = row.assessment as unknown as
          | { title: string; subject: { name: string } | null }
          | null;
        const score = Number(row.manual_score ?? row.auto_score ?? 0);
        const total = Number(row.total_points || 0);
        return {
          label: a?.title ?? "Assessment",
          subject: a?.subject?.name ?? "General",
          percent: total ? Math.round((score / total) * 100) : 0,
        };
      });
    },
  });
}

export type ClassStat = { label: string; average: number; submissions: number };

/** Average score per assessment across everything a teacher created. */
export function useTeacherAssessmentStats(teacherId?: string) {
  return useQuery({
    queryKey: ["teacher-assessment-stats", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<ClassStat[]> => {
      const { data: rows, error } = await supabase
        .from("assessments")
        .select("id, title, created_by, submissions:assessment_submissions(auto_score, manual_score, total_points, submitted_at)")
        .eq("created_by", teacherId!)
        .order("created_at");
      if (error) throw error;

      return (rows ?? []).map((a) => {
        const subs = ((a.submissions ?? []) as Array<{
          auto_score: number | null;
          manual_score: number | null;
          total_points: number | null;
          submitted_at: string | null;
        }>).filter((s) => s.submitted_at);
        const percents = subs.map((s) => {
          const score = Number(s.manual_score ?? s.auto_score ?? 0);
          const total = Number(s.total_points || 0);
          return total ? (score / total) * 100 : 0;
        });
        const average = percents.length
          ? Math.round(percents.reduce((x, y) => x + y, 0) / percents.length)
          : 0;
        return { label: a.title as string, average, submissions: subs.length };
      });
    },
  });
}
