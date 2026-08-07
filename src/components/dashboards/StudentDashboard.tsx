import { AdmissionsPanel, MeetingsPanel } from "@/components/app/SchoolLifePanels";
import { RewardsWidget } from "@/components/app/RewardsWidget";
import { MyBehaviourPanel } from "@/components/app/MyBehaviourPanel";
import { PerformanceAnalytics } from "@/components/app/PerformanceAnalytics";
import { CalendarClock, ClipboardList, Archive, BookOpen } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  useMyEnrolledClasses,
  useUpcomingSlots,
  useMyAssignments,
  useMyLocker,
} from "@/lib/school-data";
import { StatCard, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { DAYS, formatTime, formatDate } from "@/lib/format";

export function StudentDashboard({ user }: { user: User }) {
  const classes = useMyEnrolledClasses(user.id);
  const slots = useUpcomingSlots(user.id);
  const assignments = useMyAssignments(user.id);
  const locker = useMyLocker(user.id);

  const pending = (assignments.data ?? []).filter(
    (a) => !(a.submissions ?? []).some((s) => s.student_id === user.id && s.status !== "pending"),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Enrolled classes"
          value={classes.data?.length ?? 0}
          icon={BookOpen}
          loading={classes.isLoading}
        />
        <StatCard
          label="Pending assignments"
          value={pending.length}
          icon={ClipboardList}
          tone="warning"
          loading={assignments.isLoading}
        />
        <StatCard
          label="Locker items"
          value={locker.data?.length ?? 0}
          icon={Archive}
          tone="success"
          loading={locker.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RewardsWidget studentId={user.id} />
        <MyBehaviourPanel userId={user.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming classes" description="Your next scheduled sessions">
          {slots.isLoading ? (
            <ListSkeleton />
          ) : slots.data?.length ? (
            <ul className="space-y-2">
              {slots.data.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.class?.name ?? "Class"}</p>
                    <p className="text-xs text-muted-foreground">
                      {DAYS[s.day_of_week]} · {formatTime(s.start_time)}–{formatTime(s.end_time)}
                    </p>
                  </div>
                  {s.class?.room ? (
                    <Badge variant="outline" className="rounded-full">
                      {s.class.room}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No classes scheduled yet"
              hint="Once your school adds you to a class timetable, your sessions appear here."
            />
          )}
        </Panel>

        <Panel title="Pending assignments" description="Work that still needs handing in">
          {assignments.isLoading ? (
            <ListSkeleton />
          ) : pending.length ? (
            <ul className="space-y-2">
              {pending.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.class?.name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {a.due_at ? formatDate(a.due_at) : "No due date"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardList} title="You're all caught up" />
          )}
        </Panel>
      </div>

      <Panel title="Recent locker additions" description="Latest files, notes and links you saved">
        {locker.isLoading ? (
          <ListSkeleton rows={2} />
        ) : locker.data?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {locker.data.slice(0, 6).map((item) => (
              <li key={item.id} className="rounded-xl bg-secondary/50 px-4 py-3">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {item.kind} · {formatDate(item.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Archive}
            title="Your locker is empty"
            hint="Save notes, links and resources from the Locker page to find them here."
          />
        )}
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <AdmissionsPanel studentId={user.id} />
        <MeetingsPanel />
      </div>
      <PerformanceAnalytics studentId={user.id} />

    </div>
  );
}
