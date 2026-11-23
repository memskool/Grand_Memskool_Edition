import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Panel, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { formatDate } from "@/lib/format";
import { useSchoolInsights } from "@/features/academic/reports-data";

/** Phase 6: attendance trend, students who need attention, teacher activity (last 4 weeks). */
export function SchoolInsightsPanel() {
  const insights = useSchoolInsights(true);
  const d = insights.data;

  return (
    <Panel
      title="School insights"
      description="The last four weeks: attendance, learners who need attention, and teaching activity."
    >
      {insights.isLoading ? (
        <ListSkeleton rows={4} />
      ) : insights.isError ? (
        <p className="text-sm text-destructive">{authErrorMessage(insights.error)}</p>
      ) : d ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Attendance by week</h3>
            {d.attendance.some((w) => w.marks) ? (
              <ul className="space-y-2">
                {d.attendance.map((w) => (
                  <li key={w.week_start} className="text-xs">
                    <div className="mb-1 flex justify-between text-muted-foreground">
                      <span>Week of {formatDate(w.week_start)}</span>
                      <span className="tabular-nums">
                        {w.rate === null ? "no registers" : `${w.rate}% · ${w.marks} marks`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className={
                          w.rate !== null && w.rate < 75
                            ? "h-full rounded-full bg-destructive"
                            : "h-full rounded-full bg-leaf"
                        }
                        style={{ width: `${w.rate ?? 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No attendance recorded in the last four weeks.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="size-4 text-warning" /> Need attention
              <span className="font-normal text-muted-foreground">
                ({d.at_risk.length} of {d.students_total})
              </span>
            </h3>
            {d.at_risk.length ? (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {d.at_risk.map((s) => (
                  <li key={s.student_id}>
                    <Link
                      to="/grades"
                      search={{ student: s.student_id }}
                      className="block rounded-xl bg-secondary/50 px-3 py-2 text-sm hover:bg-secondary"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {s.reasons.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px]">
                            {r}
                          </Badge>
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No learner is below 75% attendance, under a 50% average, or missing 3+ pieces of
                work.
              </p>
            )}
          </section>

          <section className="lg:col-span-2">
            <h3 className="mb-2 text-sm font-semibold">Teaching activity</h3>
            {d.teachers.length ? (
              <div className="-mx-2 overflow-x-auto px-2">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Teacher</th>
                      <th className="px-2 py-1.5 font-medium">Live classes</th>
                      <th className="px-2 py-1.5 font-medium">Assignments set</th>
                      <th className="px-2 py-1.5 font-medium">Work marked</th>
                      <th className="px-2 py-1.5 font-medium">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.teachers.map((t) => (
                      <tr key={t.teacher_id} className="border-t border-border">
                        <td className="py-1.5 pr-3 font-medium">{t.name}</td>
                        <td className="px-2 py-1.5 tabular-nums">{t.live_sessions}</td>
                        <td className="px-2 py-1.5 tabular-nums">{t.assignments_set}</td>
                        <td className="px-2 py-1.5 tabular-nums">{t.marked}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {t.last_active ? formatDate(t.last_active) : "No activity"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No approved teachers yet.</p>
            )}
          </section>
        </div>
      ) : null}
    </Panel>
  );
}
