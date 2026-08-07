import { Award, Flame, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/app/primitives";
import {
  REWARD_LABELS,
  summarise,
  useDailyCheckIn,
  useRewardEvents,
} from "@/lib/rewards-data";

export function RewardsWidget({ studentId, compact }: { studentId?: string | undefined; compact?: boolean | undefined }) {
  const { data: events, isLoading } = useRewardEvents(studentId);
  const checkIn = useDailyCheckIn(studentId);

  if (isLoading || !events) {
    return (
      <Panel title="Rewards & Badges" description="Points, levels and achievements">
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  const { total, badges, level, checkedInToday } = summarise(events);
  const recent = events.slice(0, 4);

  return (
    <Panel title="Rewards & Badges" description="Points, levels and achievements">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-primary/8 p-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Level {level.rank} · {level.name}
          </p>
          <p className="font-display text-3xl font-semibold leading-tight">{total} pts</p>
        </div>
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Trophy className="size-6" />
        </span>
      </div>

      <div className="mt-3">
        <Progress value={Math.round((level.into / level.span) * 100)} className="h-2" />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {Math.max(0, level.nextAt - total)} points to level {level.rank + 1}
        </p>
      </div>

      <Button
        variant={checkedInToday ? "secondary" : "default"}
        size="sm"
        className="mt-4 w-full rounded-full"
        disabled={checkedInToday || checkIn.isPending || !studentId}
        onClick={() =>
          checkIn.mutate(undefined, {
            onSuccess: () => toast.success("Checked in — +5 points"),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Check-in failed"),
          })
        }
      >
        <Flame className="size-4" />
        {checkedInToday ? "Checked in today" : "Daily check-in (+5)"}
      </Button>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {badges.map((b) => (
          <div
            key={b.id}
            className={cn(
              "rounded-2xl border p-3 transition-colors",
              b.earned ? "border-primary/40 bg-primary/6" : "border-border",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-xl",
                  b.earned ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {b.earned ? <Award className="size-4" /> : <Sparkles className="size-4" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{b.name}</p>
                <p className="truncate text-xs text-muted-foreground">{b.description}</p>
              </div>
            </div>
            <Progress value={b.progress} className="mt-3 h-1.5" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {b.current} / {b.target}
            </p>
          </div>
        ))}
      </div>

      {!compact && recent.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                {REWARD_LABELS[e.kind] ?? e.kind}
                {e.note ? ` · ${e.note}` : ""}
              </span>
              <span className="shrink-0 font-medium text-primary">+{e.points}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
