import { MeetingsPanel } from "@/components/app/SchoolLifePanels";
import { TeacherAssessmentPanel } from "@/components/app/TeacherAssessmentPanel";
import { TeacherAssignmentPanel } from "@/components/app/TeacherAssignmentPanel";
import { LessonManager } from "@/components/app/LessonManager";
import { AttendanceRecorder } from "@/components/app/AttendanceRecorder";

import { CalendarClock, ClipboardCheck, BookOpen, Clock, BellRing } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/access";
import { useRemindSchool } from "@/lib/school-membership";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { TeacherSchoolJoin } from "@/components/app/TeacherSchoolJoin";

import { ClassCardGrid } from "@/components/dashboards/ClassCards";
import { ScheduleRail } from "@/components/app/ScheduleRail";
import type { AuthUser } from "@/types/roles";
import { AiInsightPanel } from "@/components/app/AiInsightPanel";
import { BehaviourPanel } from "@/components/app/BehaviourPanel";
import { useTeachingClasses, useTeacherTimetable, usePendingGrading } from "@/lib/school-data";
import { StatCard, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { formatDateTime } from "@/lib/format";

export function TeacherDashboard({ user }: { user: AuthUser }) {
  const { pendingApproval, schoolName, schoolId, hasSchool } = useAccess();
  const remind = useRemindSchool();
  const classes = useTeachingClasses(user.id);
  const today = useTeacherTimetable(user.id);
  const grading = usePendingGrading(user.id);

  if (!hasSchool) {
    return (
      <div className="space-y-6">
        <TeacherSchoolJoin />
      </div>
    );
  }

  if (pendingApproval) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Clock}
          title="Waiting for school approval"
          hint={`${schoolName ?? "The school"} still needs to approve you before live class, timetable and marking unlock. You can keep teaching on Gold in the meantime.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {schoolId ? (
                <Button
                  disabled={remind.isPending}
                  onClick={() =>
                    remind.mutate(schoolId, {
                      onSuccess: () =>
                        toast.success(`Reminder sent to ${schoolName ?? "your school"}`),
                      onError: (e) => toast.error(authErrorMessage(e)),
                    })
                  }
                >
                  <BellRing className="mr-2 size-4" />
                  Remind {schoolName ?? "school"}
                </Button>
              ) : null}
              <Button asChild variant="gold">
                <Link to="/gold">Teach on Gold</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          asChild
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal rounded-2xl p-4 text-left"
        >
          <Link to="/virtual-classroom">
            <span>
              <span className="block text-sm font-semibold">Start live class</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Open a lesson for a class you teach
              </span>
            </span>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal rounded-2xl p-4 text-left"
        >
          <Link to="/assessments">
            <span>
              <span className="block text-sm font-semibold">Mark work</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Assessments waiting for you
              </span>
            </span>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal rounded-2xl p-4 text-left"
        >
          <Link to="/messages">
            <span>
              <span className="block text-sm font-semibold">Messages</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Talk with your school
              </span>
            </span>
          </Link>
        </Button>
      </div>

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
          tone="leaf"
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
      <TeacherAssignmentPanel
        teacherId={user.id}
        classes={(classes.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
      />
      <LessonManager
        teacherId={user.id}
        classes={(classes.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
      />
      <AttendanceRecorder teacherId={user.id} />
      <TeacherAssessmentPanel teacherId={user.id} />
      <BehaviourPanel staffId={user.id} />
    </div>
  );
}
