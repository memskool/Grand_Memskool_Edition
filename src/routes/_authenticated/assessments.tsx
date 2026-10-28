import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, GraduationCap, Plus, Timer, Trophy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import {
  useTeacherAssessments,
  useAvailableAssessments,
  useMyAttempts,
  useTogglePublished,
  useTeacherAssessmentStats,
  useReleaseResults,
  useRevisionPlan,
  usePerformanceSummary,
  useLinkedChildResults,
} from "@/lib/assessment-data";
import { useMyChildren } from "@/lib/school-data";
import { AssessmentBuilder } from "@/components/app/AssessmentBuilder";
import { AssessmentMarking } from "@/components/app/AssessmentMarking";
import { PerformanceAnalytics } from "@/components/app/PerformanceAnalytics";
import { AskAiButton } from "@/components/app/AskAiButton";
import { authErrorMessage } from "@/lib/errors/auth-errors";
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

  if (role === "teacher" || role === "admin" || role === "institution")
    return <TeacherView userId={user?.id} />;
  if (role === "parent") return <ParentView />;
  return <StudentView userId={user?.id} />;
}

/* ------------------------------- Teacher ------------------------------- */

function TeacherView({ userId }: { userId?: string | undefined }) {
  const [tab, setTab] = useState("list");
  const list = useTeacherAssessments(userId);
  const stats = useTeacherAssessmentStats(userId);
  const toggle = useTogglePublished();
  const release = useReleaseResults();
  const [markId, setMarkId] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Set, mark and release timed quizzes and exams for your classes."
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
                              onSuccess: () => toast.success(a.published ? "Closed" : "Published"),
                              onError: (e) => toast.error(authErrorMessage(e)),
                            },
                          )
                        }
                      >
                        {a.published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                      {a.published && !a.results_released ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() =>
                            release.mutate(a.id, {
                              onSuccess: () => toast.success("Results released"),
                              onError: (e) => toast.error(authErrorMessage(e)),
                            })
                          }
                        >
                          Release results
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setMarkId(a.id)}
                      >
                        Mark
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
            {markId ? (
              <div className="mt-6">
                <h3 className="mb-2 font-display text-sm font-semibold">Marking</h3>
                <AssessmentMarking assessmentId={markId} />
              </div>
            ) : null}
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
                      {s.belowPass
                        ? ` · ${s.belowPass} below 50% — review privately, not as a ranking`
                        : ""}
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
  const revision = useRevisionPlan();
  const summary = usePerformanceSummary(userId);

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
                const related = (attempts.data ?? []).filter((row) => row.assessment_id === a.id);
                const open = related.find((row) => row.status === "in_progress");
                const finished = related.filter((row) => row.submitted_at);
                const max = a.max_attempts ?? (a.type === "practice" ? 0 : 1);
                const canRetake = !open && (max === 0 || finished.length < max);
                const done = finished.length > 0 && !open && !canRetake;
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Timer className="size-3" />
                        {a.type === "practice" ? "Practice · " : ""}
                        {a.time_limit_minutes ? `${a.time_limit_minutes} min · ` : "Untimed · "}
                        {a.total_points} pts · {a.subject?.name ?? a.class?.name ?? "General"}
                      </p>
                    </div>
                    {done ? (
                      <Badge variant="outline" className="rounded-full">
                        Submitted
                      </Badge>
                    ) : (
                      <Button asChild size="sm" className="rounded-full">
                        <Link to="/exam/$assessmentId" params={{ assessmentId: a.id }}>
                          {open ? "Resume" : finished.length ? "Retake" : "Start"}
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
                      {s.results_released === false
                        ? "Pending release"
                        : `${Number(s.manual_score ?? s.auto_score)}/${s.total_points}`}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState icon={GraduationCap} title="No results yet" />
          )}
        </Panel>

        <Panel
          title="Revision"
          description="Recommendations need at least two graded assessments on a subject or topic."
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Graded papers in your summary: {summary.data?.graded_count ?? 0}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              disabled={revision.isPending}
              onClick={() =>
                revision.mutate(undefined, {
                  onSuccess: (plan) =>
                    toast.success(plan.message ?? `${plan.items.length} focus areas ready`),
                  onError: (e) => toast.error(authErrorMessage(e)),
                })
              }
            >
              Build my revision plan
            </Button>
            <AskAiButton intent="REVISE" label="Ask AI to revise" />
          </div>
          {revision.data?.items.length ? (
            <ul className="mt-4 space-y-2">
              {revision.data.items.map((item) => (
                <li key={item.title} className="rounded-xl bg-secondary/50 px-4 py-3 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                  {item.subjectId ? (
                    <AskAiButton
                      subjectId={item.subjectId}
                      intent="REVISE"
                      label="Revise with AI"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <PerformanceAnalytics studentId={userId} />
      </div>
    </>
  );
}

/* ------------------------------- Parent -------------------------------- */

function ParentView() {
  const { user } = useSession();
  const children = useMyChildren(user?.id);
  const [selected, setSelected] = useState<string | null>(null);
  const childId = selected ?? children.data?.[0]?.student_id;
  const selectedChild = children.data?.find((c) => c.student_id === childId);
  const results = useLinkedChildResults(childId);

  if (!children.isLoading && !children.data?.length) {
    return (
      <>
        <PageHeader title="Assessments" subtitle="Released results for a linked child." />
        <EmptyState
          icon={GraduationCap}
          title="No child linked yet"
          hint="Ask your school administrator to open School Admin → Families and link your account."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle={
          selectedChild?.student?.full_name
            ? `Released results for ${selectedChild.student.full_name}.`
            : "Released results for a linked child."
        }
      />
      {(children.data?.length ?? 0) > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
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
      {results.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (
        <PerformanceAnalytics
          points={results.data ?? []}
          title="Progress report"
          description="Only released scores are shown. Unreleased papers stay hidden."
        />
      )}
    </>
  );
}
