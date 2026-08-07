import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useTeacherAssessmentStats } from "@/lib/assessment-data";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

/** Progress report shown on the teacher dashboard: average score per assessment. */
export function TeacherAssessmentPanel({ teacherId }: { teacherId?: string | undefined }) {
  const { data, isLoading } = useTeacherAssessmentStats(teacherId);

  return (
    <Panel
      title="Assessment performance"
      description="Average auto-graded score across your published papers."
    >
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : data?.length ? (
        <ul className="space-y-2">
          {data.slice(0, 6).map((s) => (
            <li key={s.label} className="rounded-xl bg-secondary/50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{s.label}</p>
                <span className="font-display text-sm font-semibold">{s.average}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${s.average}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.submissions} submission{s.submissions === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Trophy}
          title="No assessment results yet"
          hint="Publish a quiz from the Assessments page to start collecting data."
        />
      )}
      <div className="mt-4">
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to="/assessments">Open assessments</Link>
        </Button>
      </div>
    </Panel>
  );
}
