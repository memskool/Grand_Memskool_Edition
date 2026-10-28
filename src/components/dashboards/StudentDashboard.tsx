import { AdmissionsPanel, MeetingsPanel } from "@/components/app/SchoolLifePanels";
import { AiInsightPanel } from "@/components/app/AiInsightPanel";
import { RewardsWidget } from "@/components/app/RewardsWidget";
import { MyBehaviourPanel } from "@/components/app/MyBehaviourPanel";
import { PerformanceAnalytics } from "@/components/app/PerformanceAnalytics";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Archive, BookOpen } from "lucide-react";
import { ClassCardGrid } from "@/components/dashboards/ClassCards";
import { ScheduleRail } from "@/components/app/ScheduleRail";
import type { AuthUser } from "@/types/roles";
import {
  useMyEnrolledClasses,
  useUpcomingSlots,
  useMyAssignments,
  useMyLocker,
} from "@/lib/school-data";
import { AssignmentWorkPanel } from "@/components/app/AssignmentWorkPanel";
import { StatCard, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export function StudentDashboard({ user }: { user: AuthUser }) {
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
          tone="sky"
          loading={locker.isLoading}
        />
      </div>

      <AiInsightPanel userId={user.id} scope="student" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel title="My classes" description="Jump straight into a live session">
            <ClassCardGrid
              classes={classes.data ?? []}
              loading={classes.isLoading}
              emptyHint="You are not in a school class yet. Explore Dream School, open your locker, or ask the AI Tutor — join a school later when you have one."
            />
            {!classes.isLoading && !classes.data?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="rounded-full" variant="outline" size="sm">
                  <Link to="/dream-school">Explore Dream School</Link>
                </Button>
                <Button asChild className="rounded-full" variant="outline" size="sm">
                  <Link to="/locker">Open locker</Link>
                </Button>
                <Button asChild className="rounded-full" variant="outline" size="sm">
                  <Link to="/ai-tutor">Ask the AI Tutor</Link>
                </Button>
                <Button asChild className="rounded-full" variant="outline" size="sm">
                  <Link to="/marketplace">Book store</Link>
                </Button>
              </div>
            ) : null}
          </Panel>

          <AssignmentWorkPanel studentId={user.id} />
        </div>

        <ScheduleRail
          slots={slots.data ?? []}
          loading={slots.isLoading}
          title="Upcoming classes"
          description="Your next sessions"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RewardsWidget studentId={user.id} />
        <MyBehaviourPanel userId={user.id} />
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
