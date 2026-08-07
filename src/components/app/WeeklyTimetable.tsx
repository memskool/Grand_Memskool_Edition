import { CalendarDays } from "lucide-react";
import type { TimetableSlot } from "@/lib/discovery-data";
import { DAYS, formatTime } from "@/lib/format";
import { EmptyState } from "@/components/app/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function WeeklyTimetable({
  slots,
  loading,
  onRemove,
}: {
  slots: TimetableSlot[];
  loading?: boolean;
  onRemove?: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!slots.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No lessons scheduled yet"
        hint="Once a school admin adds class slots they appear here instantly."
      />
    );
  }

  const today = new Date().getDay();

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {WEEK.map((day) => {
        const daySlots = slots.filter((s) => s.day_of_week === day);
        if (!daySlots.length && (day === 0 || day === 6)) return null;
        return (
          <div
            key={day}
            className={cn(
              "rounded-2xl border border-border p-3",
              day === today && "border-primary/40 bg-primary/5",
            )}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {DAYS[day]}
            </p>
            {daySlots.length ? (
              <ul className="space-y-2">
                {daySlots.map((slot) => (
                  <li key={slot.id} className="rounded-xl bg-secondary/60 p-3">
                    <p className="truncate text-sm font-medium">{slot.class?.name ?? "Class"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {slot.class?.subject?.name ?? "General"}
                      {slot.class?.teacher?.full_name ? ` · ${slot.class.teacher.full_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-medium text-primary">
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </p>
                    {slot.class?.room ? (
                      <p className="text-xs text-muted-foreground">Room {slot.class.room}</p>
                    ) : null}
                    {onRemove ? (
                      <button
                        type="button"
                        onClick={() => onRemove(slot.id)}
                        className="mt-2 text-xs font-medium text-destructive hover:underline"
                      >
                        Remove slot
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">Free day</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
