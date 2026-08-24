import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlarmClock, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useAuth";
import {
  useAssessment,
  useAssessmentQuestions,
  useAttemptClock,
  useLogIntegrity,
  useSaveAttemptAnswers,
  useStartAttempt,
  useSubmitAttempt,
} from "@/lib/assessment-data";
import { setExamMode } from "@/lib/exam-mode";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { QuestionRenderer } from "@/features/assessment/QuestionRenderer";

export const Route = createFileRoute("/_authenticated/exam/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Examination — Memskool" },
      {
        name: "description",
        content: "Timed Memskool assessment with server-authoritative timing.",
      },
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
  const saveAnswers = useSaveAttemptAnswers();
  const integrity = useLogIntegrity();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [optionOrder, setOptionOrder] = useState<Record<string, string[]>>({});
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<{
    autoScore: number;
    totalPoints: number;
    manualPending: boolean;
    resultsReleased: boolean;
  } | null>(null);
  const submittedRef = useRef(false);
  const clock = useAttemptClock(attemptId && !result ? attemptId : undefined);

  const isExam =
    (assessment.data?.type ?? "quiz") === "exam" || (assessment.data?.type ?? "") === "test";

  useEffect(() => {
    setExamMode(isExam);
    return () => setExamMode(false);
  }, [isExam]);

  useEffect(() => {
    if (!user?.id || attemptId) return;
    startAttempt
      .mutateAsync({ assessmentId, studentId: user.id })
      .then((row) => {
        setAttemptId(row.id);
        setAnswers(row.answers ?? {});
        setOrder(row.question_order ?? []);
        setOptionOrder(row.option_order ?? {});
        setEndsAt(row.ends_at ?? null);
        integrity.mutate({ attemptId: row.id, event: row.resumed ? "resumed" : "started" });
        if (row.submitted_at) {
          submittedRef.current = true;
          setResult({
            autoScore: 0,
            totalPoints: 0,
            manualPending: false,
            resultsReleased: false,
          });
        }
      })
      .catch((e) => toast.error(authErrorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, assessmentId]);

  useEffect(() => {
    if (!attemptId || result) return;
    const onVis = () => {
      integrity.mutate({
        attemptId,
        event: document.hidden ? "visibility_hidden" : "visibility_visible",
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [attemptId, result, integrity]);

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current || !attemptId) return;
      submittedRef.current = true;
      integrity.mutate({ attemptId, event: auto ? "auto_submit" : "submit_attempted" });
      try {
        const res = await submitAttempt.mutateAsync({ attemptId, answers });
        setResult({ ...res, resultsReleased: res.resultsReleased ?? true });
        setExamMode(false);
        toast.success(auto ? "Time up — paper submitted" : "Paper submitted");
      } catch (e) {
        submittedRef.current = false;
        toast.error(authErrorMessage(e));
      }
    },
    [attemptId, answers, submitAttempt, integrity],
  );

  useEffect(() => {
    if (result) return;
    const baseMs =
      clock.data?.remaining_ms ?? (endsAt ? Math.max(0, Date.parse(endsAt) - Date.now()) : null);
    if (baseMs == null) return;
    const fetchedAt = clock.dataUpdatedAt || Date.now();
    const tick = () => {
      const left = Math.round((baseMs - (Date.now() - fetchedAt)) / 1000);
      setRemaining(left);
      if (left <= 0) void doSubmit(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, result, doSubmit, clock.data?.remaining_ms, clock.dataUpdatedAt]);

  useEffect(() => {
    if (!attemptId || result) return;
    const id = window.setTimeout(() => {
      setSaveState("saving");
      saveAnswers.mutate(
        { attemptId, answers },
        {
          onSuccess: () => setSaveState("saved"),
          onError: () => {
            setSaveState("error");
            integrity.mutate({ attemptId, event: "save_failed" });
          },
        },
      );
    }, 2500);
    return () => window.clearTimeout(id);
  }, [answers, attemptId, result, saveAnswers, integrity]);

  const orderedQuestions = useMemo(() => {
    const list = questions.data ?? [];
    if (!order.length) return list;
    const byId = new Map(list.map((q) => [q.id, q]));
    return order.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
  }, [questions.data, order]);

  const total = orderedQuestions.length;
  const answered = orderedQuestions.filter((q) => (answers[q.id] ?? "").trim()).length;
  const q = orderedQuestions[current];
  const low = remaining !== null && remaining <= 60;

  const setAnswer = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold">
            {assessment.data?.title ?? "Assessment"}
          </p>
          <p className="text-xs text-muted-foreground">
            {answered}/{total} answered
            {assessment.data?.type ? ` · ${assessment.data.type}` : ""}
            {saveState === "saving"
              ? " · Saving…"
              : saveState === "saved"
                ? " · Saved"
                : saveState === "error"
                  ? " · Save failed — retrying"
                  : ""}
          </p>
        </div>
        {!result && endsAt ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 font-display text-lg font-semibold tabular-nums",
              low ? "bg-destructive/12 text-destructive" : "bg-secondary",
            )}
            role="timer"
            aria-live="polite"
            aria-label={
              remaining === null ? "Time remaining unknown" : `${formatClock(remaining)} remaining`
            }
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
              {result.resultsReleased
                ? result.manualPending
                  ? "Objective questions were marked. Written answers await your teacher."
                  : "Your paper was marked automatically."
                : "Your teacher will release results. This screen does not show a score yet."}
            </p>
            {result.resultsReleased ? (
              <p className="mt-6 font-display text-4xl font-semibold">
                {result.autoScore}
                <span className="text-xl text-muted-foreground">/{result.totalPoints}</span>
              </p>
            ) : null}
          </div>
        ) : assessment.isLoading || questions.isLoading || !attemptId ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : !q ? (
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

            <div className="flex flex-wrap gap-1" role="navigation" aria-label="Questions">
              {orderedQuestions.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "size-8 rounded-full text-xs font-medium",
                    i === current ? "bg-primary text-primary-foreground" : "bg-secondary",
                    (answers[item.id] ?? "").trim() && i !== current
                      ? "ring-1 ring-primary/40"
                      : "",
                  )}
                  aria-label={`Question ${i + 1}${(answers[item.id] ?? "").trim() ? ", answered" : ", unanswered"}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <section className="surface-card p-5">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                  {current + 1}
                </span>
                <p className="flex-1 text-sm font-medium leading-relaxed">{q.prompt}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{q.points} pt</span>
              </div>
              <QuestionRenderer
                kind={q.kind}
                options={optionOrder[q.id] ?? q.options}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswer(q.id, v)}
              />
            </section>

            <div className="flex justify-between pb-8">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={current === 0}
                onClick={() => setCurrent((n) => Math.max(0, n - 1))}
              >
                Previous
              </Button>
              {current < total - 1 ? (
                <Button className="rounded-full" onClick={() => setCurrent((n) => n + 1)}>
                  Next
                </Button>
              ) : (
                <Button
                  className="rounded-full"
                  onClick={() => doSubmit(false)}
                  disabled={submitAttempt.isPending}
                >
                  Submit paper
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
