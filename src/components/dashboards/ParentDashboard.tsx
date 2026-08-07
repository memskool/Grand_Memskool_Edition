import { AdmissionsPanel, MeetingsPanel } from "@/components/app/SchoolLifePanels";
import { PerformanceAnalytics } from "@/components/app/PerformanceAnalytics";
import { useState } from "react";
import { CalendarCheck, TrendingUp, Users, GraduationCap } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useMyChildren, useMyAttendance, useChildPerformance } from "@/lib/school-data";
import { StatCard, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";

export function ParentDashboard({ user }: { user: User }) {
  const children = useMyChildren(user.id);
  const [selected, setSelected] = useState<string | null>(null);
  const childId = selected ?? children.data?.[0]?.student_id;

  const attendance = useMyAttendance(childId);
  const performance = useChildPerformance(childId);

  const records = attendance.data ?? [];
  const present = records.filter((r) => r.status === "present").length;
  const rate = records.length ? Math.round((present / records.length) * 100) : 0;

  const graded = (performance.data ?? []).filter((s) => s.grade !== null);
  const average = graded.length
    ? Math.round(graded.reduce((sum, s) => sum + Number(s.grade ?? 0), 0) / graded.length)
    : 0;

  if (!children.isLoading && !children.data?.length) {
    return (
      <EmptyState
        icon={Users}
        title="No child linked to your account yet"
        hint="Ask your school administrator to link your child's Memskool account to yours."
      />
    );
  }

  return (
    <div className="space-y-6">
      {(children.data?.length ?? 0) > 1 ? (
        <div className="flex flex-wrap gap-2">
          {children.data!.map((c) => (
            <Button
              key={c.student_id}
              size="sm"
              variant={c.student_id === childId ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setSelected(c.student_id)}
            >
              {c.student?.full_name || "Child"}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Attendance rate"
          value={`${rate}%`}
          icon={CalendarCheck}
          tone="success"
          loading={attendance.isLoading}
        />
        <StatCard
          label="Average grade"
          value={graded.length ? `${average}%` : "—"}
          icon={TrendingUp}
          loading={performance.isLoading}
        />
        <StatCard
          label="Graded items"
          value={graded.length}
          icon={GraduationCap}
          tone="warning"
          loading={performance.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Attendance summary" description="Recorded school days">
          {attendance.isLoading ? (
            <ListSkeleton rows={2} />
          ) : records.length ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Present</span>
                  <span className="font-medium">
                    {present} of {records.length} days
                  </span>
                </div>
                <Progress value={rate} className="h-2" />
              </div>
              <ul className="space-y-2">
                {records.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-2.5 text-sm"
                  >
                    <span>{formatDate(r.date)}</span>
                    <span className="capitalize text-muted-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState icon={CalendarCheck} title="No attendance recorded yet" />
          )}
        </Panel>

        <Panel title="Weekly performance" description="Most recent graded work">
          {performance.isLoading ? (
            <ListSkeleton />
          ) : graded.length ? (
            <ul className="space-y-2">
              {graded.slice(0, 6).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.assignment?.title}</p>
                    <p className="text-xs text-muted-foreground">{s.assignment?.class?.name}</p>
                  </div>
                  <span className="font-display text-sm font-semibold">
                    {Number(s.grade)}/{s.assignment?.points ?? 100}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={TrendingUp} title="No graded work yet" />
          )}
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AdmissionsPanel studentId={childId} title="Child's applications" description="Admission progress for your child" />
        <MeetingsPanel />
      </div>
      <PerformanceAnalytics
        studentId={childId}
        title="Progress report"
        description="Assessment grade trend for your child."
      />

    </div>
  );
}
