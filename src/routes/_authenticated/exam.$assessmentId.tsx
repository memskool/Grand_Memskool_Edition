import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlarmClock, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useAuth";
import {
  useAssessment,
  useAssessmentQuestions,
  useStartAttempt,
  useSubmitAttempt,
  type AssessmentSubmission,
} from "@/lib/assessment-data";
import { setExamMode } from "@/lib/exam-mode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exam/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Examination — Memskool" },
      {
        name: "description",
        content: "Distraction-free timed examination with live countdown and auto-submit.",
      },
      { property: "og:title", content: "Examination — Memskool" },
      { property: "og:description", content: "Take your timed Memskool assessment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamPage,
});

function formatClock(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function ExamPage() {
  const { assessmentId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();

  const assessment = useAssessment(assessmentId);
  const questions = useAssessmentQuestions(assessmentId);
  const startAttempt = useStartAttempt();
  const submitAttempt = useSubmitAttempt();

  const [attempt, setAttempt] = useState<AssessmentSubmission | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<{
    autoScore: number;
    totalPoints: number;
    manualPending: boolean;
  } | null>(null);
  const submittedRef = useRef(false);

  // Lock AI surfaces for the whole session.
  useEffect(() => {
    setExamMode(true);
    return () => setExamMode(false);
  }, []);

  // Start (or resume) the attempt.
  useEffect(() => {
    if (!user?.id || attempt) return;
    startAttempt
      .mutateAsync({ assessmentId, studentId: user.id })
      .then((row) => {
        setAttempt(row);
        setAnswers((row.answers as Record<string, string>) ?? {});
        if (row.submitted_at) {
          submittedRef.current = true;
          setResult({
            autoScore: Number(row.auto_score),
            totalPoints: Number(row.total_points),
            manualPending: row.status === "submitted",
          });
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not start this exam"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, assessmentId]);

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current || !attempt || !assessment.data || !questions.data) return;
      submittedRef.current = true;
      try {
        const res = await submitAttempt.mutateAsync({
          submissionId: attempt.id,
          answers,
        });
        setResult(res);
        setExamMode(false);
        toast.success(auto ? "Time up — paper submitted automatically" : "Paper submitted");
      } catch (e) {
        submittedRef.current = false;
        toast.error(e instanceof Error ? e.message : "Submission failed");
      }
    },
    [attempt, assessment.data, questions.data, answers, submitAttempt],
  );

  // Countdown
  const limit = assessment.data?.time_limit_minutes;
  useEffect(() => {
    if (!attempt || !limit || result) return;
    const deadline = new Date(attempt.started_at).getTime() + limit * 60_000;
    const tick = () => {
      const left = Math.round((deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) void doSubmit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt, limit, result, doSubmit]);

  const total = questions.data?.length ?? 0;
  const answered = useMemo(
    () => (questions.data ?? []).filter((q) => (answers[q.id] ?? "").trim()).length,
    [questions.data, answers],
  );

  const low = remaining !== null && remaining <= 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold">
            {assessment.data?.title ?? "Examination"}
          </p>
          <p className="text-xs text-muted-foreground">
            {answered}/{total} answered · pass mark {assessment.data?.passing_score ?? 50}%
          </p>
        </div>
        {!result ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 font-display text-lg font-semibold tabular-nums",
              low ? "animate-pulse bg-destructive/12 text-destructive" : "bg-secondary",
            )}
          >
            <AlarmClock className="size-4" />
            {remaining === null ? "--:--" : formatClock(remaining)}
          </div>
        ) : null}
        {!result ? (
          <Button
            className="rounded-full"
            onClick={() => doSubmit(false)}
            disabled={submitAttempt.isPending}
          >
            {submitAttempt.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Submit
          </Button>
        ) : (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => navigate({ to: "/assessments" })}
          >
            Back to assessments
          </Button>
        )}
      </header>

      <Progress value={total ? (answered / total) * 100 : 0} className="h-1 rounded-none" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {result ? (
          <div className="surface-card p-8 text-center">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-success/12 text-success">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="font-display text-2xl font-semibold">Paper submitted</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.manualPending
                ? "Your multiple-choice answers were graded instantly. Short answers are with your teacher."
                : "Your paper was auto-graded instantly."}
            </p>
            <p className="mt-6 font-display text-4xl font-semibold">
              {result.autoScore}
              <span className="text-xl text-muted-foreground">/{result.totalPoints}</span>
            </p>
          </div>
        ) : assessment.isLoading || questions.isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : !questions.data?.length ? (
          <div className="surface-card p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">This assessment has no questions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assessment.data?.description ? (
              <p className="rounded-2xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                {assessment.data.description}
              </p>
            ) : null}

            {questions.data.map((q, i) => (
              <section key={q.id} className="surface-card p-5">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm font-medium leading-relaxed">{q.prompt}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{q.points} pt</span>
                </div>

                {q.kind === "multiple_choice" ? (
                  <div className="space-y-2 pl-10">
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                            selected
                              ? "border-primary bg-primary/8 font-medium"
                              : "border-border hover:bg-secondary/60",
                          )}
                        >
                          <span
                            className={cn(
                              "size-4 shrink-0 rounded-full border-2",
                              selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                            )}
                          />
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="pl-10">
                    <Textarea
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Type your answer…"
                      rows={4}
                    />
                  </div>
                )}
              </section>
            ))}

            <div className="flex justify-end pb-8">
              <Button
                size="lg"
                className="rounded-full"
                onClick={() => doSubmit(false)}
                disabled={submitAttempt.isPending}
              >
                {submitAttempt.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Submit paper
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
