import { useState } from "react";
import { toast } from "sonner";
import {
  useAssessmentQuestions,
  useAssessmentResults,
  useMarkAttempt,
} from "@/lib/assessment-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/app/primitives";
import { authErrorMessage } from "@/lib/errors/auth-errors";

export function AssessmentMarking({ assessmentId }: { assessmentId: string }) {
  const results = useAssessmentResults(assessmentId);
  const questions = useAssessmentQuestions(assessmentId);
  const mark = useMarkAttempt();
  const [open, setOpen] = useState<string | null>(null);
  const attempt = (results.data ?? []).find((r) => r.id === open);
  const [points, setPoints] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  if (results.isLoading) return <ListSkeleton rows={2} />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Only this class’s submissions are shown. Manual marks are yours — the AI does not finalise
        scores.
      </p>
      <ul className="space-y-2">
        {(results.data ?? []).map((row) => (
          <li key={row.id} className="rounded-xl bg-secondary/50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{row.student?.full_name ?? "Student"}</p>
                <p className="text-xs text-muted-foreground">{row.status.replace("_", " ")}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setOpen(row.id)}
              >
                Review
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {attempt ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          {(questions.data ?? []).map((q) => (
            <div key={q.id} className="space-y-1">
              <p className="text-sm font-medium">{q.prompt}</p>
              <p className="text-xs text-muted-foreground">
                Answer: {attempt.answers?.[q.id] || "—"}
              </p>
              {(q.kind === "short_answer" || q.kind === "long_answer") && (
                <div className="space-y-2">
                  <Input
                    type="number"
                    min={0}
                    max={q.points}
                    className="h-8 w-24"
                    value={points[q.id] ?? attempt.question_marks?.[q.id] ?? 0}
                    onChange={(e) => setPoints((p) => ({ ...p, [q.id]: Number(e.target.value) }))}
                    aria-label={`Marks for ${q.prompt}`}
                  />
                  <Input
                    value={feedback[q.id] ?? ""}
                    onChange={(e) => setFeedback((f) => ({ ...f, [q.id]: e.target.value }))}
                    placeholder="Optional feedback"
                    aria-label={`Feedback for ${q.prompt}`}
                  />
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={mark.isPending}
              onClick={() =>
                mark.mutate(
                  {
                    attemptId: attempt.id,
                    finalize: false,
                    marks: (questions.data ?? [])
                      .filter((q) => q.kind === "short_answer" || q.kind === "long_answer")
                      .map((q) => ({
                        question_id: q.id,
                        points: points[q.id] ?? attempt.question_marks?.[q.id] ?? 0,
                        feedback: feedback[q.id] || null,
                      })),
                  },
                  {
                    onSuccess: () => toast.success("Progress saved"),
                    onError: (e) => toast.error(authErrorMessage(e)),
                  },
                )
              }
            >
              Save progress
            </Button>
            <Button
              className="rounded-full"
              disabled={mark.isPending}
              onClick={() =>
                mark.mutate(
                  {
                    attemptId: attempt.id,
                    finalize: true,
                    marks: (questions.data ?? [])
                      .filter((q) => q.kind === "short_answer" || q.kind === "long_answer")
                      .map((q) => ({
                        question_id: q.id,
                        points: points[q.id] ?? attempt.question_marks?.[q.id] ?? 0,
                        feedback: feedback[q.id] || null,
                      })),
                  },
                  {
                    onSuccess: () => toast.success("Marks finalised"),
                    onError: (e) => toast.error(authErrorMessage(e)),
                  },
                )
              }
            >
              Save and finalise
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
