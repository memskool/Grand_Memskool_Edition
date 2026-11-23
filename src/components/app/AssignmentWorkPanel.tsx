import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AskAiButton } from "@/components/app/AskAiButton";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { useSubmitAssignment } from "@/features/academic/academic-data";
import { useMyAssignments } from "@/lib/school-data";
import { useAccess } from "@/lib/access";
import { buildObjectPath, uploadSchoolObject } from "@/lib/storage";
import { formatDate, formatDateTime } from "@/lib/format";
import { canSubmit, formatMark } from "@/features/academic/grading-policy";
import { UploadsOffNote } from "@/components/app/UploadsOffNote";
import { useUploadsReady } from "@/hooks/useUploadsReady";

type MySubmission = {
  student_id: string;
  status: string;
  grade: number | null;
  feedback?: string | null;
  graded_at?: string | null;
  returned_at?: string | null;
  submitted_at?: string | null;
  late?: boolean;
};

function SubmissionBadge({ mine, points }: { mine: MySubmission; points: number }) {
  if (mine.status === "graded" && mine.grade !== null) {
    return (
      <Badge className="ml-2 bg-leaf text-leaf-foreground">{formatMark(mine.grade, points)}</Badge>
    );
  }
  if (mine.status === "returned") {
    return (
      <Badge variant="destructive" className="ml-2">
        Returned — needs changes
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="ml-2">
      {mine.late ? "Handed in late · awaiting mark" : "Handed in · awaiting mark"}
    </Badge>
  );
}

export function AssignmentWorkPanel({ studentId }: { studentId: string }) {
  const assignments = useMyAssignments(studentId);
  const submit = useSubmitAssignment();
  const { schoolId } = useAccess();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const uploadsReady = useUploadsReady();

  return (
    <Panel
      title="Assignments"
      description="Submit from here. Success means the server received your work."
    >
      {assignments.isLoading ? (
        <ListSkeleton rows={3} />
      ) : assignments.data?.length ? (
        <ul className="space-y-2">
          {assignments.data.map((a) => {
            const mine = (a.submissions ?? []).find((s) => s.student_id === studentId) as
              MySubmission | undefined;
            const late = Boolean(a.due_at && new Date(a.due_at).getTime() < Date.now() && !mine);
            const allowed = canSubmit(
              mine ?? null,
              (a as { allow_resubmit?: boolean }).allow_resubmit,
            );
            return (
              <li key={a.id} className="rounded-2xl bg-secondary/50 px-4 py-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    if (openId !== a.id) {
                      // Each assignment starts with an empty draft.
                      setText("");
                      setPaths([]);
                    }
                    setOpenId(openId === a.id ? null : a.id);
                  }}
                >
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.class?.name} · {a.due_at ? `due ${formatDate(a.due_at)}` : "no due date"} ·{" "}
                    {a.points} pts
                    {mine ? (
                      <SubmissionBadge mine={mine} points={a.points} />
                    ) : late ? (
                      <Badge variant="destructive" className="ml-2">
                        Late if you submit now
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2">
                        Not started
                      </Badge>
                    )}
                  </p>
                </button>
                {openId === a.id ? (
                  <div className="mt-3 space-y-2">
                    {a.description ? (
                      <p className="text-sm text-muted-foreground">{a.description}</p>
                    ) : null}
                    {mine && (mine.status === "graded" || mine.status === "returned") ? (
                      <div
                        className={
                          mine.status === "graded"
                            ? "rounded-2xl border border-leaf/40 bg-leaf/10 p-3"
                            : "rounded-2xl border border-destructive/40 bg-destructive/10 p-3"
                        }
                      >
                        <p className="text-sm font-medium">
                          {mine.status === "graded" && mine.grade !== null
                            ? `Your mark: ${formatMark(mine.grade, a.points)}`
                            : "Your teacher returned this for changes"}
                        </p>
                        {mine.feedback ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm">{mine.feedback}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {mine.status === "graded" && mine.graded_at
                            ? `Marked ${formatDateTime(mine.graded_at)}`
                            : mine.returned_at
                              ? `Returned ${formatDateTime(mine.returned_at)} — update your work and submit again`
                              : ""}
                        </p>
                      </div>
                    ) : mine ? (
                      <p className="text-xs text-muted-foreground">
                        Handed in {formatDateTime(mine.submitted_at ?? null)}
                        {mine.late ? " (late)" : ""}. Your teacher has not marked it yet.
                      </p>
                    ) : null}
                    <AskAiButton
                      assignmentId={a.id}
                      intent="ASSIGNMENT_HELP"
                      label="Ask AI about this assignment"
                    />
                    {!allowed.ok ? (
                      <p className="text-xs text-muted-foreground">{allowed.reason}</p>
                    ) : null}
                    <Textarea
                      rows={3}
                      disabled={!allowed.ok}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Write your answer or notes"
                    />
                    {!uploadsReady ? <UploadsOffNote what="File attachments" /> : null}
                    <InputFile
                      disabled={!schoolId || !allowed.ok || !uploadsReady}
                      onFile={async (file) => {
                        if (!schoolId) return;
                        const path = `schools/${schoolId}/submissions/${studentId}/${a.id}/${buildObjectPath("", file.name).replace(/^\//, "")}`;
                        await uploadSchoolObject(path, file);
                        setPaths((p) => [...p, path]);
                        toast.success("File attached. Submit when you are ready.");
                      }}
                    />
                    {paths.length ? (
                      <p className="text-xs text-muted-foreground">{paths.length} file(s) ready</p>
                    ) : null}
                    <Button
                      className="rounded-full"
                      disabled={submit.isPending || !allowed.ok}
                      onClick={() =>
                        submit.mutate(
                          {
                            assignment_id: a.id,
                            text_body: text.trim() || null,
                            storage_paths: paths,
                          },
                          {
                            onSuccess: (res) => {
                              setText("");
                              setPaths([]);
                              toast.success(res.late ? "Submitted late" : "Submitted");
                            },
                            onError: (e) =>
                              toast.error(
                                authErrorMessage(e) ===
                                  "Network problem. Check your connection and try again."
                                  ? "Could not submit. Check your connection — it was not recorded."
                                  : authErrorMessage(e),
                              ),
                          },
                        )
                      }
                    >
                      {mine ? "Submit again" : "Submit work"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={ClipboardList} title="No assignments yet" />
      )}
    </Panel>
  );
}

function InputFile({
  onFile,
  disabled,
}: {
  onFile: (file: File) => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <input
      type="file"
      disabled={disabled}
      className="text-sm"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
          await onFile(file);
        } catch (err) {
          toast.error(authErrorMessage(err));
        }
      }}
    />
  );
}
