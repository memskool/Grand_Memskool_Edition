import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CornerUpLeft, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListSkeleton } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { getSchoolObjectUrl } from "@/lib/storage";
import {
  useAssignmentSubmissions,
  useMarkSubmission,
  type AssignmentSubmissionRow,
} from "@/features/academic/academic-data";
import { formatMark, needsMarking, validateGrade } from "@/features/academic/grading-policy";

type Filter = "to_mark" | "marked" | "returned" | "missing" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "to_mark", label: "To mark" },
  { id: "marked", label: "Marked" },
  { id: "returned", label: "Returned" },
  { id: "missing", label: "Not handed in" },
  { id: "all", label: "All" },
];

function rowFilter(row: AssignmentSubmissionRow): Exclude<Filter, "all"> {
  const s = row.submission;
  if (!s) return "missing";
  if (s.status === "graded") return "marked";
  if (s.status === "returned") return "returned";
  return needsMarking(s.status, s.grade) ? "to_mark" : "marked";
}

export function SubmissionReviewDialog({
  assignmentId,
  focusStudentId,
  open,
  onOpenChange,
}: {
  assignmentId: string | null;
  /** Pre-select this student (e.g. opened from "Pending grading"). */
  focusStudentId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useAssignmentSubmissions(open && assignmentId ? assignmentId : undefined);
  const [filter, setFilter] = useState<Filter>("to_mark");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => data.data?.rows ?? [], [data.data]);
  const counts = useMemo(() => {
    const c = { to_mark: 0, marked: 0, returned: 0, missing: 0, all: rows.length };
    for (const r of rows) c[rowFilter(r)] += 1;
    return c;
  }, [rows]);
  const visible = filter === "all" ? rows : rows.filter((r) => rowFilter(r) === filter);
  const current = rows.find((r) => r.student_id === selected) ?? null;

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setFilter("to_mark");
      return;
    }
    if (focusStudentId) {
      setSelected(focusStudentId);
      setFilter("all");
    }
  }, [open, focusStudentId]);

  // Default the selection to the first row of the current filter once data loads.
  useEffect(() => {
    if (!open || selected || !visible.length) return;
    setSelected(visible[0]!.student_id);
  }, [open, selected, visible]);

  const assignment = data.data?.assignment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{assignment?.title ?? "Submissions"}</DialogTitle>
          <DialogDescription>
            {assignment
              ? `${counts.all - counts.missing} of ${counts.all} handed in · ${counts.marked} marked · out of ${assignment.points} points${assignment.due_at ? ` · due ${formatDateTime(assignment.due_at)}` : ""}`
              : "Loading the class list…"}
          </DialogDescription>
        </DialogHeader>

        {data.isLoading ? (
          <div className="p-5">
            <ListSkeleton rows={4} />
          </div>
        ) : data.isError ? (
          <p className="p-5 text-sm text-destructive">{authErrorMessage(data.error)}</p>
        ) : (
          <div className="grid min-h-0 gap-0 md:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
              <div className="flex flex-wrap gap-1.5 p-3">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFilter(f.id);
                      setSelected(null);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      filter === f.id
                        ? "border-ink bg-ink text-ink-foreground"
                        : "border-border bg-background hover:bg-secondary",
                    )}
                  >
                    {f.label} ({counts[f.id]})
                  </button>
                ))}
              </div>
              <ScrollArea className="max-h-[22dvh] md:max-h-[62dvh]">
                {visible.length ? (
                  <ul className="space-y-1 px-2 pb-3">
                    {visible.map((r) => (
                      <li key={r.student_id}>
                        <button
                          type="button"
                          onClick={() => setSelected(r.student_id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                            selected === r.student_id ? "bg-secondary" : "hover:bg-secondary/60",
                          )}
                        >
                          <span className="truncate">{r.student_name}</span>
                          <StatusBadge row={r} points={assignment?.points ?? 100} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 pb-4 text-xs text-muted-foreground">Nobody here.</p>
                )}
              </ScrollArea>
            </div>

            <ScrollArea className="max-h-[58dvh] md:max-h-[70dvh]">
              <div className="p-5">
                {current && assignment ? (
                  <ReviewPane
                    key={`${current.student_id}-${current.submission?.id ?? "none"}-${current.submission?.status ?? ""}`}
                    row={current}
                    assignmentId={assignment.id}
                    points={assignment.points}
                    onDone={() => {
                      // Move on to the next student still waiting for a mark.
                      const next = rows.find(
                        (r) => r.student_id !== current.student_id && rowFilter(r) === "to_mark",
                      );
                      setSelected(next?.student_id ?? null);
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Pick a student to see their work.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ row, points }: { row: AssignmentSubmissionRow; points: number }) {
  const s = row.submission;
  if (!s) return <Badge variant="outline">Missing</Badge>;
  if (s.status === "graded" && s.grade !== null) {
    return (
      <Badge className="bg-leaf text-leaf-foreground">
        {formatMark(s.grade, points).split(" (")[0]}
      </Badge>
    );
  }
  if (s.status === "returned") return <Badge variant="secondary">Returned</Badge>;
  return <Badge variant={s.late ? "destructive" : "outline"}>{s.late ? "Late" : "New"}</Badge>;
}

function ReviewPane({
  row,
  assignmentId,
  points,
  onDone,
}: {
  row: AssignmentSubmissionRow;
  assignmentId: string;
  points: number;
  onDone: () => void;
}) {
  const s = row.submission;
  const mark = useMarkSubmission();
  const [grade, setGrade] = useState(
    s?.grade !== null && s?.grade !== undefined ? String(s.grade) : "",
  );
  const [feedback, setFeedback] = useState(s?.feedback ?? "");

  if (!s) {
    return (
      <div className="space-y-2">
        <h3 className="font-display text-lg font-bold">{row.student_name}</h3>
        <p className="text-sm text-muted-foreground">
          Has not handed this in yet. You can assign catch-up work from Missed Work.
        </p>
      </div>
    );
  }

  const saveMark = () => {
    const value = Number(grade);
    const problem = grade.trim() === "" ? "Enter a mark." : validateGrade(value, points);
    if (problem) {
      toast.error(problem);
      return;
    }
    mark.mutate(
      {
        action: "grade",
        assignment_id: assignmentId,
        submission_id: s.id,
        grade: value,
        feedback: feedback.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Marked ${row.student_name}: ${formatMark(value, points)}`);
          onDone();
        },
        onError: (e) => toast.error(authErrorMessage(e)),
      },
    );
  };

  const returnForChanges = () => {
    if (!feedback.trim()) {
      toast.error("Write feedback so the student knows what to change.");
      return;
    }
    mark.mutate(
      {
        action: "return",
        assignment_id: assignmentId,
        submission_id: s.id,
        feedback: feedback.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`Returned to ${row.student_name} for changes`);
          onDone();
        },
        onError: (e) => toast.error(authErrorMessage(e)),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold">{row.student_name}</h3>
        <p className="text-xs text-muted-foreground">
          Handed in {formatDateTime(s.submitted_at)}
          {s.late ? " · late" : ""}
          {s.status === "graded" && s.graded_at ? ` · marked ${formatDateTime(s.graded_at)}` : ""}
          {s.status === "returned" && s.returned_at
            ? ` · returned ${formatDateTime(s.returned_at)} — waiting for the student`
            : ""}
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-background p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Student&apos;s work
        </p>
        {s.text_body ? (
          <p className="whitespace-pre-wrap break-words text-sm">{s.text_body}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No written answer.</p>
        )}
        {s.storage_paths.length ? (
          <ul className="flex flex-wrap gap-2 pt-1">
            {s.storage_paths.map((path) => (
              <li key={path}>
                <AttachmentButton path={path} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="mark-grade">Mark (out of {points})</Label>
          <Input
            id="mark-grade"
            inputMode="decimal"
            type="number"
            min={0}
            max={points}
            step="0.5"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mark-feedback">Feedback</Label>
          <Textarea
            id="mark-feedback"
            rows={4}
            maxLength={4000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What went well, and what to improve"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-full" onClick={saveMark} disabled={mark.isPending}>
          {mark.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {s.status === "graded" ? "Update mark" : "Save mark"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={returnForChanges}
          disabled={mark.isPending}
        >
          <CornerUpLeft className="size-4" /> Return for changes
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The student is notified either way. Returning lets them hand the work in again.
      </p>
    </div>
  );
}

function AttachmentButton({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  const name = path.split("/").pop() ?? "File";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.open(await getSchoolObjectUrl(path), "_blank", "noopener,noreferrer");
        } catch (error) {
          toast.error(authErrorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
      className="flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs hover:bg-secondary disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
      <span className="max-w-48 truncate">{name}</span>
    </button>
  );
}
