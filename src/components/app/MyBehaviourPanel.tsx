import { ShieldCheck } from "lucide-react";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { isActiveSuspension, useMyDisciplinaryActions } from "@/lib/discipline-data";

export function MyBehaviourPanel({ userId }: { userId?: string | undefined }) {
  const { data, isLoading } = useMyDisciplinaryActions(userId);

  return (
    <Panel title="Conduct record" description="Warnings and suspensions on your account">
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Clean record"
          hint="No warnings or suspensions — keep it up."
        />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((a) => {
            const live = isActiveSuspension(a);
            return (
              <li key={a.id} className="rounded-2xl border border-border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{a.reason}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(a.created_at)}
                      {a.ends_at ? ` · until ${formatDateTime(a.ends_at)}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={live ? "destructive" : "secondary"}
                    className="shrink-0 rounded-full capitalize"
                  >
                    {live ? "active" : a.kind}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Even during a suspension, Missed Work, your Personal Locker and Notes stay open.
      </p>
    </Panel>
  );
}
