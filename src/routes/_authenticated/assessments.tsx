import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  GraduationCap,
  Plus,
  Timer,
  Trophy,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import {
  useTeacherAssessments,
  useAvailableAssessments,
  useMyAttempts,
  useTogglePublished,
  useDeleteAssessment,
  useTeacherAssessmentStats,
} from "@/lib/assessment-data";
import { AssessmentBuilder } from "@/components/app/AssessmentBuilder";
import { PerformanceAnalytics } from "@/components/app/PerformanceAnalytics";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/assessments")({
  head: () => ({
    meta: [
      { title: "Assessments — Memskool" },
      {
        name: "description",
        content:
          "Create timed quizzes, sit examinations and track auto-graded results across every Memskool class.",
      },
      { property: "og:title", content: "Assessments — Memskool" },
      {
        property: "og:description",
        content: "Timed quizzes, instant auto-grading and performance analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);

  if (role === "teacher" || role === "admin") return <TeacherView userId={user?.id} />;
  if (role === "parent") return <ParentView />;
  return <StudentView userId={user?.id} />;
}

/* ------------------------------- Teacher ------------------------------- */

function TeacherView({ userId }: { userId?: string | undefined }) {
  const [tab, setTab] = useState("list");
  const list = useTeacherAssessments(userId);
  const stats = useTeacherAssessmentStats(userId);
  const toggle = useTogglePublished();
  const remove = useDeleteAssessment();

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Design timed quizzes and exams, then watch results grade themselves."
        action={
          <Button className="rounded-full" onClick={() => setTab("build")}>
            <Plus className="size-4" /> New assessment
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5 rounded-full">
          <TabsTrigger value="list" className="rounded-full">
            My assessments
          </TabsTrigger>
          <TabsTrigger value="build" className="rounded-full">
            Builder
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-full">
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Panel title="Created assessments">
            {list.isLoading ? (
              <ListSkeleton />
            ) : list.data?.length ? (
              <ul className="space-y-2">
                {list.data.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.class?.name ?? "No class"} · {a.time_limit_minutes} min · pass{" "}
                        {a.passing_score}% · {a.total_points} pts
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.published ? "default" : "outline"} className="rounded-full">
                        {a.published ? "Published" : "Draft"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={a.published ? "Unpublish" : "Publish"}
                        onClick={() =>
                          toggle.mutate(
                            { id: a.id, published: !a.published },
                            {
                              onSuccess: () =>
                                toast.success(a.published ? "Unpublished" : "Published"),
                            },
                          )
                        }
                      >
                        {a.published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label="Delete assessment"
                        onClick={() =>
                          remove.mutate(a.id, { onSuccess: () => toast.success("Deleted") })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title="No assessments yet"
                hint="Head to the Builder tab to create your first timed quiz."
              />
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="build">
          <Panel title="Assessment builder" description="Multiple choice auto-grades instantly.">
            <AssessmentBuilder teacherId={userId} onCreated={() => setTab("list")} />
          </Panel>
        </TabsContent>

        <TabsContent value="analytics">
          <Panel title="Class performance" description="Average score per assessment.">
            {stats.isLoading ? (
              <ListSkeleton />
            ) : stats.data?.length ? (
              <ul className="space-y-2">
                {stats.data.map((s) => (
                  <li key={s.label} className="rounded-xl bg-secondary/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{s.label}</p>
                      <span className="font-display text-sm font-semibold">{s.average}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${s.average}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.submissions} submission{s.submissions === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Trophy} title="No submissions to analyse yet" />
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ------------------------------- Student ------------------------------- */

function StudentView({ userId }: { userId?: string | undefined }) {
  const available = useAvailableAssessments(userId);
  const attempts = useMyAttempts(userId);

  const attemptFor = (id: string) => attempts.data?.find((a) => a.assessment_id === id);

  return (
    <>
      <PageHeader title="Assessments" subtitle="Your quizzes, exams and results." />

      <div className="space-y-6">
        <Panel title="Available now" description="Timers start the moment you open a paper.">
          {available.isLoading ? (
            <ListSkeleton />
          ) : available.data?.length ? (
            <ul className="space-y-2">
              {available.data.map((a) => {
                const attempt = attemptFor(a.id);
                const done = !!attempt?.submitted_at;
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Timer className="size-3" />
                        {a.time_limit_minutes} min · {a.total_points} pts ·{" "}
                        {a.subject?.name ?? a.class?.name ?? "General"}
                      </p>
                    </div>
                    {done ? (
                      <Badge variant="outline" className="rounded-full">
                        Submitted
                      </Badge>
                    ) : (
                      <Button asChild size="sm" className="rounded-full">
                        <Link to="/exam/$assessmentId" params={{ assessmentId: a.id }}>
                          {attempt ? "Resume" : "Start"}
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={ClipboardCheck} title="No assessments available" />
          )}
        </Panel>

        <Panel title="My results">
          {attempts.isLoading ? (
            <ListSkeleton />
          ) : attempts.data?.filter((a) => a.submitted_at).length ? (
            <ul className="space-y-2">
              {attempts.data
                .filter((a) => a.submitted_at)
                .map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.assessment?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(s.submitted_at)} ·{" "}
                        {s.status === "graded" ? "Graded" : "Awaiting teacher marks"}
                      </p>
                    </div>
                    <span className="font-display text-sm font-semibold">
                      {Number(s.manual_score ?? s.auto_score)}/{s.total_points}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState icon={GraduationCap} title="No results yet" />
          )}
        </Panel>

        <PerformanceAnalytics studentId={userId} />
      </div>
    </>
  );
}

/* ------------------------------- Parent -------------------------------- */

function ParentView() {
  const { user } = useSession();
  return (
    <>
      <PageHeader title="Assessments" subtitle="Your child's exam performance." />
      <PerformanceAnalytics
        studentId={user?.id}
        title="Progress report"
        description="Open the Dashboard to switch between children."
      />
    </>
  );
}
