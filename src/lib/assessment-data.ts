import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { triggerNotificationDelivery } from "@/lib/notifications-data";
import {
  closeAssessment,
  generateRevisionPlan,
  getAttemptClock,
  listLinkedChildResults,
  logAssessmentIntegrity,
  markAssessmentAttempt,
  ownerAssessmentQuestions,
  publishAssessment,
  releaseAssessmentResults,
  saveAssessment,
  saveAttemptAnswers,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from "@/lib/assessment.functions";
import { classifyFirebase } from "@/lib/errors/app-error";
import { PRODUCT_EVENTS, trackProductEvent } from "@/lib/analytics";
import type { AssessmentType, EngineQuestionKind } from "@/features/assessment/contracts";
import { useMyEnrolledClasses } from "@/lib/school-data";
import { COLLECTIONS, findMany, getById, where, orderBy, limit } from "@/lib/firebase/repo";
import {
  attachClassName,
  attachSubject,
  attachNamedUser,
  userSchoolId,
} from "@/lib/firebase/hydrate";

export type QuestionKind = EngineQuestionKind;

export type AssessmentQuestion = {
  id: string;
  assessment_id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
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
  status?: string;
  type?: AssessmentType;
  max_attempts?: number;
  results_released?: boolean;
  reveal_answers?: boolean;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  available_from?: string | null;
  available_until?: string | null;
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
  status: "in_progress" | "submitted" | "awaiting_manual" | "graded";
  started_at: string;
  ends_at?: string | null;
  submitted_at: string | null;
  results_released?: boolean;
  question_order?: string[];
  option_order?: Record<string, string[]>;
  question_marks?: Record<string, number>;
  assessment?: Assessment | null;
  student?: { id: string; full_name: string } | null;
};

async function hydrateAssessment(row: Assessment): Promise<Assessment> {
  const withClass = await attachClassName(row);
  const withSubject = await attachSubject(withClass);
  return withSubject as Assessment;
}

export function useTeacherAssessments(userId?: string) {
  return useQuery({
    queryKey: ["assessments", "teacher", userId],
    enabled: !!userId,
    queryFn: async () => {
      const rows = await findMany<Assessment>(COLLECTIONS.assessments, [
        where("created_by", "==", userId!),
        orderBy("created_at", "desc"),
        limit(40),
      ]);
      return Promise.all(rows.map(hydrateAssessment));
    },
  });
}

export function useAvailableAssessments(studentId?: string) {
  const enrolled = useMyEnrolledClasses(studentId);
  const classIds = new Set((enrolled.data ?? []).map((c) => c.id));
  return useQuery({
    queryKey: ["assessments", "available", studentId, [...classIds].sort().join(",")],
    enabled: !!studentId && !enrolled.isLoading,
    queryFn: async () => {
      const schoolId = await userSchoolId(studentId);
      if (!schoolId || classIds.size === 0) return [];
      const rows = await findMany<Assessment>(COLLECTIONS.assessments, [
        where("school_id", "==", schoolId),
        where("published", "==", true),
        orderBy("created_at", "desc"),
      ]);
      const now = Date.now();
      return Promise.all(
        rows
          .filter((row) => !row.class_id || classIds.has(row.class_id))
          .filter((row) => {
            if (row.available_from && Date.parse(row.available_from) > now) return false;
            if (row.available_until && Date.parse(row.available_until) < now) return false;
            return true;
          })
          .map(hydrateAssessment),
      );
    },
  });
}

export function useAssessment(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const row = await getById<Assessment>(COLLECTIONS.assessments, assessmentId!);
      return row ? hydrateAssessment(row) : null;
    },
  });
}

export function useAssessmentQuestions(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment-questions", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const rows = await findMany<AssessmentQuestion>(COLLECTIONS.assessmentQuestions, [
        where("assessment_id", "==", assessmentId!),
        orderBy("position"),
      ]);
      return rows.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: undefined,
      }));
    },
  });
}

export function useAssessmentAnswerKey(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment-questions", "owner", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const rows = await ownerAssessmentQuestions({ data: { assessmentId: assessmentId! } });
      return rows.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : [],
      })) as AssessmentQuestion[];
    },
  });
}

export function useMyAttempts(studentId?: string) {
  return useQuery({
    queryKey: ["assessment-submissions", "student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const rows = await findMany<AssessmentSubmission>(COLLECTIONS.assessmentSubmissions, [
        where("student_id", "==", studentId!),
        orderBy("created_at", "desc"),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const assessment = await getById<Assessment>(COLLECTIONS.assessments, row.assessment_id);
          return {
            ...row,
            assessment: assessment ? await hydrateAssessment(assessment) : null,
          };
        }),
      );
    },
  });
}

export function useAssessmentResults(assessmentId?: string) {
  return useQuery({
    queryKey: ["assessment-submissions", "assessment", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const rows = await findMany<AssessmentSubmission>(COLLECTIONS.assessmentSubmissions, [
        where("assessment_id", "==", assessmentId!),
        orderBy("submitted_at", "desc"),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const named = (await attachNamedUser(
            row,
            row.student_id,
            "student",
          )) as AssessmentSubmission;
          if (named.question_marks || named.manual_score != null || named.auto_score != null)
            return named;
          const priv = await getById<{
            auto_score: number;
            manual_score: number | null;
            question_marks: Record<string, number>;
          }>(COLLECTIONS.assessmentResultPrivate, row.id);
          if (!priv) return named;
          return {
            ...named,
            auto_score: priv.auto_score,
            manual_score: priv.manual_score,
            question_marks: priv.question_marks,
          };
        }),
      );
    },
  });
}

export type DraftQuestion = {
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_answer: string;
  accepted?: string[];
  points: number;
  topic_id?: string | null;
  explanation?: string | null;
  save_to_bank?: boolean;
};

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      assessmentId?: string | null;
      title: string;
      description: string;
      class_id: string;
      subject_id: string | null;
      type: AssessmentType;
      time_limit_minutes: number;
      passing_score: number;
      max_attempts: number;
      results_released: boolean;
      reveal_answers: boolean;
      shuffle_questions: boolean;
      shuffle_options: boolean;
      available_from?: string | null;
      available_until?: string | null;
      published?: boolean;
      questions: DraftQuestion[];
    }) => {
      try {
        const saved = await saveAssessment({
          data: {
            assessmentId: input.assessmentId ?? null,
            title: input.title,
            description: input.description,
            class_id: input.class_id,
            subject_id: input.subject_id,
            type: input.type,
            time_limit_minutes: input.time_limit_minutes,
            passing_score: input.passing_score,
            max_attempts: input.max_attempts,
            available_from: input.available_from ?? null,
            available_until: input.available_until ?? null,
            results_released: input.results_released,
            reveal_answers: input.reveal_answers,
            shuffle_questions: input.shuffle_questions,
            shuffle_options: input.shuffle_options,
            questions: input.questions.map((q) => ({
              kind: q.kind,
              prompt: q.prompt,
              options: q.options,
              correct_answer: q.correct_answer,
              points: q.points,
              ...(q.accepted ? { accepted: q.accepted } : {}),
              ...(q.topic_id ? { topic_id: q.topic_id } : {}),
              ...(q.explanation ? { explanation: q.explanation } : {}),
              ...(q.save_to_bank ? { save_to_bank: true } : {}),
            })),
          },
        });
        if (input.published) await publishAssessment({ data: { assessmentId: saved.id } });
        return saved.id;
      } catch (error) {
        throw classifyFirebase(error);
      }
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
      try {
        if (published) await publishAssessment({ data: { assessmentId: id } });
        else await closeAssessment({ data: { assessmentId: id } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });
}

export function useStartAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assessmentId }: { assessmentId: string; studentId?: string }) => {
      try {
        const row = await startAssessmentAttempt({ data: { assessmentId } });
        return {
          id: row.attemptId,
          assessment_id: assessmentId,
          started_at: row.started_at,
          ends_at: row.ends_at,
          answers: row.answers,
          question_order: row.question_order,
          option_order: row.option_order,
          status: "in_progress" as const,
          submitted_at: null,
          resumed: row.resumed,
        };
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-submissions"] });
      triggerNotificationDelivery();
    },
  });
}

export function useSubmitAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      submissionId,
      attemptId,
      answers,
    }: {
      submissionId?: string;
      attemptId?: string;
      answers: Record<string, string>;
    }) => {
      try {
        const id = attemptId ?? submissionId;
        if (!id) throw new Error("Attempt not found.");
        const row = await submitAssessmentAttempt({ data: { attemptId: id, answers } });
        return {
          autoScore: Number(row.autoScore ?? 0),
          totalPoints: Number(row.totalPoints ?? 0),
          manualPending: !!row.manualPending,
          resultsReleased: row.resultsReleased,
        };
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-submissions"] });
      triggerNotificationDelivery();
      void trackProductEvent(PRODUCT_EVENTS.assessmentSubmitted, { outcome: "success" });
    },
  });
}

export function useSaveAttemptAnswers() {
  return useMutation({
    mutationFn: async (input: { attemptId: string; answers: Record<string, string> }) => {
      try {
        return await saveAttemptAnswers({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
  });
}

export function useAttemptClock(attemptId?: string) {
  return useQuery({
    queryKey: ["attempt-clock", attemptId],
    enabled: !!attemptId,
    refetchInterval: 20_000,
    queryFn: async () => getAttemptClock({ data: { attemptId: attemptId! } }),
  });
}

export function useReleaseResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assessmentId: string) => {
      try {
        await releaseAssessmentResults({ data: { assessmentId } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });
}

export function useMarkAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      attemptId: string;
      marks: Array<{ question_id: string; points: number; feedback: string | null }>;
      finalize: boolean;
    }) => {
      try {
        return await markAssessmentAttempt({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-submissions"] }),
  });
}

export function useLogIntegrity() {
  return useMutation({
    mutationFn: async (input: {
      attemptId: string;
      event:
        | "started"
        | "resumed"
        | "visibility_hidden"
        | "visibility_visible"
        | "save_failed"
        | "submit_attempted"
        | "auto_submit";
    }) => {
      try {
        await logAssessmentIntegrity({ data: input });
      } catch {
        /* integrity logging must never block the exam */
      }
    },
  });
}

export function useRevisionPlan() {
  return useMutation({
    mutationFn: async () => {
      try {
        return await generateRevisionPlan();
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
  });
}

export function usePerformanceSummary(studentId?: string) {
  return useQuery({
    queryKey: ["performance-summary", studentId],
    enabled: !!studentId,
    queryFn: () =>
      getById<{
        graded_count: number;
        by_subject: Record<string, { percent: number; attempts: number }>;
        updated_at: string;
      }>(COLLECTIONS.performanceSummaries, studentId!),
  });
}

export type TrendPoint = { label: string; percent: number; subject: string };

export function usePerformanceTrend(studentId?: string) {
  return useQuery({
    queryKey: ["performance-trend", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<TrendPoint[]> => {
      const rows = await findMany<{
        auto_score: number | null;
        manual_score: number | null;
        total_points: number | null;
        submitted_at: string | null;
        assessment_id: string;
        results_released?: boolean;
      }>(COLLECTIONS.assessmentSubmissions, [
        where("student_id", "==", studentId!),
        orderBy("submitted_at", "asc"),
      ]);
      const submitted = rows.filter((r) => r.submitted_at && r.results_released !== false);
      return Promise.all(
        submitted.map(async (row) => {
          const assessment = await getById<{ title: string; subject_id?: string | null }>(
            COLLECTIONS.assessments,
            row.assessment_id,
          );
          const hydrated = assessment ? await attachSubject(assessment) : null;
          const score = Number(row.manual_score ?? row.auto_score ?? 0);
          const total = Number(row.total_points || 0);
          return {
            label: hydrated?.title ?? "Assessment",
            subject: hydrated?.subject?.name ?? "General",
            percent: total ? Math.round((score / total) * 100) : 0,
          };
        }),
      );
    },
  });
}

export type ClassStat = {
  label: string;
  average: number;
  submissions: number;
  belowPass: number;
};

export function useQuestionBank(userId?: string) {
  return useQuery({
    queryKey: ["question-bank", userId],
    enabled: !!userId,
    queryFn: async () => {
      const schoolId = await userSchoolId(userId);
      if (!schoolId) return [];
      return findMany<{
        prompt: string;
        kind: QuestionKind;
        options: string[];
        correct_answer: string;
        accepted?: string[];
        points: number;
        topic_id?: string | null;
      }>(COLLECTIONS.questionBank, [
        where("school_id", "==", schoolId),
        orderBy("created_at", "desc"),
        limit(40),
      ]);
    },
  });
}

export function useLinkedChildResults(studentId?: string) {
  return useQuery({
    queryKey: ["linked-child-results", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      try {
        return await listLinkedChildResults({ data: { studentId: studentId! } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
  });
}

export function useTeacherAssessmentStats(teacherId?: string) {
  return useQuery({
    queryKey: ["teacher-assessment-stats", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<ClassStat[]> => {
      const assessments = await findMany<{ title: string }>(COLLECTIONS.assessments, [
        where("created_by", "==", teacherId!),
        orderBy("created_at", "asc"),
      ]);
      return Promise.all(
        assessments.map(async (a) => {
          const subs = await findMany<{
            auto_score: number | null;
            manual_score: number | null;
            total_points: number | null;
            submitted_at: string | null;
          }>(COLLECTIONS.assessmentSubmissions, [where("assessment_id", "==", a.id)]);
          const done = subs.filter((s) => s.submitted_at);
          const percents = done.map((s) => {
            const score = Number(s.manual_score ?? s.auto_score ?? 0);
            const total = Number(s.total_points || 0);
            return total ? (score / total) * 100 : 0;
          });
          const average = percents.length
            ? Math.round(percents.reduce((x, y) => x + y, 0) / percents.length)
            : 0;
          const belowPass = percents.filter((p) => p < 50).length;
          return { label: a.title, average, submissions: done.length, belowPass };
        }),
      );
    },
  });
}
