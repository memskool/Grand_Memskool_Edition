import { CalendarClock } from "lucide-react";
import { DAYS, formatTime } from "@/lib/format";
import { EmptyState, ListSkeleton } from "@/components/app/primitives";

type Slot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  class?: { name: string; room?: string | null } | null;
};

export function ScheduleRail({
  slots,
  loading,
  title = "Schedule",
  description,
}: {
  slots: Slot[];
  loading?: boolean;
  title?: string;
  description?: string;
}) {
  return (
    <aside className="surface-card p-5 sm:p-6">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <span className="text-xs font-medium text-muted-foreground">{slots.length}</span>
      </header>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing scheduled"
          hint="Sessions appear here once your timetable is set."
        />
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {slots.map((s) => (
            <li key={s.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-gold" />
              <p className="text-xs font-medium tabular-nums text-muted-foreground">
                {formatTime(s.start_time)} – {formatTime(s.end_time)}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold">{s.class?.name ?? "Class"}</p>
              <p className="text-xs text-muted-foreground">
                {DAYS[s.day_of_week]}
                {s.class?.room ? ` · ${s.class.room}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
