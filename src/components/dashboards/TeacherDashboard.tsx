import { MeetingsPanel } from "@/components/app/SchoolLifePanels";
import { TeacherAssessmentPanel } from "@/components/app/TeacherAssessmentPanel";
import { CalendarClock, ClipboardCheck, BookOpen } from "lucide-react";
import { ClassCardGrid } from "@/components/dashboards/ClassCards";
import { ScheduleRail } from "@/components/app/ScheduleRail";
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel title="Active classes" description="Classes you currently teach">
            <ClassCardGrid
              classes={classes.data ?? []}
              loading={classes.isLoading}
              emptyHint="An administrator can assign classes to your account."
            />
          </Panel>

          <Panel title="Pending grading" description="Submissions waiting for your feedback">
            {grading.isLoading ? (
              <ListSkeleton />
            ) : grading.data?.length ? (
              <ul className="space-y-2">
                {grading.data.slice(0, 6).map((s) => (
                  <li key={s.id} className="rounded-2xl bg-secondary/60 px-4 py-3">
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

        <ScheduleRail
          slots={today.data ?? []}
          loading={today.isLoading}
          title="Today's timetable"
          description="Your sessions for today"
        />
      </div>
      <MeetingsPanel />
      <TeacherAssessmentPanel teacherId={user.id} />
      <BehaviourPanel staffId={user.id} />
    </div>
  );
}
