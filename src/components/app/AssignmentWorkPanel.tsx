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
import { formatDate } from "@/lib/format";

export function AssignmentWorkPanel({ studentId }: { studentId: string }) {
  const assignments = useMyAssignments(studentId);
  const submit = useSubmitAssignment();
  const { schoolId } = useAccess();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [paths, setPaths] = useState<string[]>([]);

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
            const mine = (a.submissions ?? []).find((s) => s.student_id === studentId);
            const late = Boolean(a.due_at && new Date(a.due_at).getTime() < Date.now() && !mine);
            return (
              <li key={a.id} className="rounded-2xl bg-secondary/50 px-4 py-3">
                <button type="button" className="w-full text-left" onClick={() => setOpenId(a.id)}>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.class?.name} · {a.due_at ? `due ${formatDate(a.due_at)}` : "no due date"} ·{" "}
                    {a.points} pts
                    {mine ? (
                      <Badge variant="outline" className="ml-2 capitalize">
                        {mine.status}
                      </Badge>
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
                    <AskAiButton
                      assignmentId={a.id}
                      intent="ASSIGNMENT_HELP"
                      label="Ask AI about this assignment"
                    />
                    <Textarea
                      rows={3}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Write your answer or notes"
                    />
                    <InputFile
                      disabled={!schoolId}
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
                      disabled={submit.isPending}
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
                      Submit work
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
