import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, GraduationCap } from "lucide-react";
import { useSession, useRole } from "@/hooks/useAuth";
import { useMyAssignments, usePendingGrading, useChildPerformance } from "@/lib/school-data";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/assessments")({
  head: () => ({
    meta: [
      { title: "Assessments — Memskool" },
      {
        name: "description",
        content: "Track assignments, submissions and grades across all your Memskool classes.",
      },
      { property: "og:title", content: "Assessments — Memskool" },
      { property: "og:description", content: "Assignments, submissions and grades in one view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);
  const isTeacher = role === "teacher";

  const assignments = useMyAssignments(isTeacher ? undefined : user?.id);
  const grading = usePendingGrading(isTeacher ? user?.id : undefined);
  const myGrades = useChildPerformance(isTeacher ? undefined : user?.id);

  if (isTeacher) {
    return (
      <>
        <PageHeader title="Assessments" subtitle="Submissions waiting for your feedback." />
        <Panel title="Grading queue">
          {grading.isLoading ? (
            <ListSkeleton />
          ) : grading.data?.length ? (
            <ul className="space-y-2">
              {grading.data.map((s) => (
                <li key={s.id} className="rounded-xl bg-secondary/50 px-4 py-3">
                  <p className="truncate text-sm font-medium">{s.assignment?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.student?.full_name || "Student"} · {formatDateTime(s.submitted_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardCheck} title="Nothing to grade" />
          )}
        </Panel>
      </>
    );
  }

  const graded = (myGrades.data ?? []).filter((s) => s.grade !== null);

  return (
    <>
      <PageHeader title="Assessments" subtitle="Your assignments and results." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="All assignments">
          {assignments.isLoading ? (
            <ListSkeleton />
          ) : assignments.data?.length ? (
            <ul className="space-y-2">
              {assignments.data.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.class?.name}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-full">
                    {a.due_at ? formatDate(a.due_at) : "No due date"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardCheck} title="No assignments yet" />
          )}
        </Panel>

        <Panel title="Results">
          {myGrades.isLoading ? (
            <ListSkeleton />
          ) : graded.length ? (
            <ul className="space-y-2">
              {graded.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
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
            <EmptyState icon={GraduationCap} title="No results published yet" />
          )}
        </Panel>
      </div>
    </>
  );
}
