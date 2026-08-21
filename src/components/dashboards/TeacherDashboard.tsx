import { MeetingsPanel } from "@/components/app/SchoolLifePanels";
import { TeacherAssessmentPanel } from "@/components/app/TeacherAssessmentPanel";
import { CalendarClock, ClipboardCheck, Users, BookOpen } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { AiInsightPanel } from "@/components/app/AiInsightPanel";
import { BehaviourPanel } from "@/components/app/BehaviourPanel";
import { useTeachingClasses, useTeacherTimetable, usePendingGrading } from "@/lib/school-data";
import { StatCard, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { formatTime, formatDateTime } from "@/lib/format";

export function TeacherDashboard({ user }: { user: User }) {
  const classes = useTeachingClasses(user.id);
  const today = useTeacherTimetable(user.id);
  const grading = usePendingGrading(user.id);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active classes"
          value={classes.data?.length ?? 0}
          icon={BookOpen}
          loading={classes.isLoading}
        />
        <StatCard
          label="Sessions today"
          value={today.data?.length ?? 0}
          icon={CalendarClock}
          tone="success"
          loading={today.isLoading}
        />
        <StatCard
          label="Awaiting grading"
          value={grading.data?.length ?? 0}
          icon={ClipboardCheck}
          tone="warning"
          loading={grading.isLoading}
        />
      </div>

      <AiInsightPanel userId={user.id} scope="teacher" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Today's timetable" description="Your sessions for today">
          {today.isLoading ? (
            <ListSkeleton />
          ) : today.data?.length ? (
            <ul className="space-y-2">
              {today.data.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.class?.name ?? "Class"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(s.start_time)}–{formatTime(s.end_time)}
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
            <EmptyState icon={CalendarClock} title="Nothing scheduled today" />
          )}
        </Panel>

        <Panel title="Pending grading" description="Submissions waiting for your feedback">
          {grading.isLoading ? (
            <ListSkeleton />
          ) : grading.data?.length ? (
            <ul className="space-y-2">
              {grading.data.slice(0, 6).map((s) => (
                <li key={s.id} className="rounded-xl bg-secondary/50 px-4 py-3">
                  <p className="truncate text-sm font-medium">{s.assignment?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.student?.full_name || "Student"} · {formatDateTime(s.submitted_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardCheck} title="No submissions to grade" />
          )}
        </Panel>
      </div>

      <Panel title="Active classes" description="Classes you currently teach">
        {classes.isLoading ? (
          <ListSkeleton rows={2} />
        ) : classes.data?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {classes.data.map((c) => (
              <li key={c.id} className="rounded-xl bg-secondary/50 px-4 py-3">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.subject?.name ?? "No subject"}
                  {c.room ? ` · ${c.room}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Users}
            title="No classes assigned yet"
            hint="An administrator can assign classes to your account."
          />
        )}
      </Panel>
      <MeetingsPanel />
      <TeacherAssessmentPanel teacherId={user.id} />
      <BehaviourPanel staffId={user.id} />
    </div>
  );
}
