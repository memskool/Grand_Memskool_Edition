import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, ShieldOff } from "lucide-react";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import {
  isActiveSuspension,
  useAllDisciplinaryActions,
  useIssueAction,
  useLiftAction,
  useStudentDirectory,
} from "@/lib/discipline-data";

export function BehaviourPanel({ staffId }: { staffId?: string }) {
  const students = useStudentDirectory(!!staffId);
  const actions = useAllDisciplinaryActions(!!staffId);
  const issue = useIssueAction(staffId);
  const lift = useLiftAction();

  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState<"warning" | "suspension">("warning");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("3");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !reason.trim()) {
      toast.error("Pick a student and give a reason");
      return;
    }
    issue.mutate(
      {
        student_id: studentId,
        kind,
        reason: reason.trim(),
        days: kind === "suspension" ? Number(days) || 3 : null,
      },
      {
        onSuccess: () => {
          toast.success(kind === "suspension" ? "Suspension issued" : "Warning issued");
          setReason("");
          setStudentId("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not issue action"),
      },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Issue a behaviour action" description="Warnings and timed suspensions">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {(students.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name || "Unnamed student"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="suspension">Temporary suspension</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind === "suspension" ? (
              <div className="space-y-2">
                <Label htmlFor="bp-days">Duration (days)</Label>
                <Input
                  id="bp-days"
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bp-reason">Reason</Label>
            <Textarea
              id="bp-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the misconduct"
            />
          </div>

          <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Suspended learners lose Live Classroom and messaging access, but keep full access to
            Missed Work, their Personal Locker and Notes.
          </p>

          <Button type="submit" className="rounded-full" disabled={issue.isPending}>
            <ShieldAlert className="size-4" />
            Issue action
          </Button>
        </form>
      </Panel>

      <Panel title="Behaviour log" description="Recent warnings and suspensions">
        {actions.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (actions.data ?? []).length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No behaviour actions" hint="A clean record so far." />
        ) : (
          <ul className="space-y-3">
            {(actions.data ?? []).map((a) => {
              const live = isActiveSuspension(a);
              return (
                <li key={a.id} className="rounded-2xl border border-border p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.student?.full_name || "Student"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.reason}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDateTime(a.created_at)}
                        {a.ends_at ? ` · until ${formatDateTime(a.ends_at)}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={live ? "destructive" : "secondary"}
                      className="shrink-0 rounded-full capitalize"
                    >
                      {a.kind}
                    </Badge>
                  </div>
                  {live ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 rounded-full"
                      disabled={lift.isPending}
                      onClick={() =>
                        lift.mutate(a.id, {
                          onSuccess: () => toast.success("Suspension lifted"),
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : "Could not lift"),
                        })
                      }
                    >
                      <ShieldOff className="size-4" />
                      Lift suspension
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
