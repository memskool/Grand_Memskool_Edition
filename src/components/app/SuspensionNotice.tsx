import { ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { DisciplinaryAction } from "@/lib/discipline-data";

export function SuspensionNotice({
  suspension,
  feature,
}: {
  suspension: DisciplinaryAction;
  feature: string;
}) {
  return (
    <div className="surface-card border-destructive/40 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">{feature} is paused</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You are currently suspended, so {feature.toLowerCase()} is unavailable.
          </p>
          <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">{suspension.reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {suspension.ends_at
              ? `Access returns on ${formatDateTime(suspension.ends_at)}.`
              : "Speak to your teacher or school admin about lifting this."}
          </p>
          <p className="mt-3 text-sm font-medium text-primary">
            Your Missed Work, Personal Locker and Notes stay fully open — keep learning.
          </p>
        </div>
      </div>
    </div>
  );
}
