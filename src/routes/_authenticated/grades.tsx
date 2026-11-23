import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, GraduationCap, Printer } from "lucide-react";
import { useSession, useRole } from "@/hooks/useAuth";
import { useAccess } from "@/lib/access";
import { useTeachingClasses } from "@/lib/school-data";
import { useSchoolClasses } from "@/features/academic/academic-data";
import {
  useClassGradebook,
  useMyChildrenForReports,
  useSaveReportComment,
  useSetGradingWeights,
  useStudentReportCard,
  type GradebookData,
} from "@/features/academic/reports-data";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BOM, toCsv } from "@/features/academic/report-policy";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  ChipGroup,
  PageHeader,
  Panel,
  EmptyState,
  ListSkeleton,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/grades")({
  head: () => ({
    meta: [
      { title: "Grades — Memskool" },
      { name: "description", content: "Gradebooks and term report cards." },
    ],
  }),
  // ?student=<id> opens a report card straight away (from the gradebook).
  validateSearch: (search: Record<string, unknown>): { student?: string } =>
    typeof search["student"] === "string" && search["student"]
      ? { student: search["student"] }
      : {},
  component: GradesPage,
});

const ALL_TIME = "__all__";

function pct(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

function GradesPage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);
  const { student } = Route.useSearch();

  if (!user || !role) return <ListSkeleton rows={4} />;
  if (role === "student") return <ReportCardScreen studentId={user.id} />;
  if (role === "parent") return <ParentReports />;
  if (student) {
    return (
      <>
        <Link
          to="/grades"
          className="mb-3 inline-block text-sm font-medium text-primary hover:underline"
          data-print-hide
        >
          ← Back to gradebook
        </Link>
        <ReportCardScreen studentId={student} />
      </>
    );
  }
  return <GradebookScreen userId={user.id} role={role} />;
}

/* ------------------------------------------------------------------ */
/* Term picker                                                         */
/* ------------------------------------------------------------------ */

function TermSelect({
  periods,
  value,
  onChange,
}: {
  periods: Array<{ id: string; name: string; starts_on: string; ends_on: string }>;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  // Chips, not a dropdown: every term is visible and one tap away.
  return (
    <ChipGroup
      label="Term"
      value={value ?? ALL_TIME}
      onChange={(v) => onChange(v === ALL_TIME ? null : v)}
      options={[
        { value: ALL_TIME, label: "All work" },
        ...periods.map((p) => ({
          value: p.id,
          label: p.name,
          hint: `${formatDate(p.starts_on)} – ${formatDate(p.ends_on)}`,
        })),
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Gradebook (teachers and school managers)                            */
/* ------------------------------------------------------------------ */

function GradebookScreen({ userId, role }: { userId: string; role: string }) {
  const { schoolId } = useAccess();
  const isTeacher = role === "teacher";
  const teaching = useTeachingClasses(isTeacher ? userId : undefined);
  const school = useSchoolClasses(isTeacher ? undefined : (schoolId ?? undefined));
  const classes = useMemo(
    () =>
      (isTeacher
        ? (teaching.data ?? []).map((c) => ({ id: c.id, name: c.name }))
        : (school.data ?? []).map((c) => ({ id: c.id, name: c.name }))
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [isTeacher, teaching.data, school.data],
  );
  const [classId, setClassId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);
  const book = useClassGradebook(classId, periodId);
  const loadingClasses = isTeacher ? teaching.isLoading : school.isLoading;

  return (
    <>
      <PageHeader
        title="Gradebook"
        subtitle="Every mark in a class, with averages, missing work and a report card per learner."
      />
      <div className="mb-5 space-y-3" data-print-hide>
        {classes.length ? (
          <ChipGroup
            label="Class"
            value={classId}
            onChange={setClassId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TermSelect periods={book.data?.periods ?? []} value={periodId} onChange={setPeriodId} />
          {book.data?.rows.length ? (
            <Button variant="outline" onClick={() => exportCsv(book.data!)}>
              <Download className="size-4" /> Export CSV
            </Button>
          ) : null}
        </div>
      </div>
      {book.data?.can_set_weights ? <WeightsControl current={book.data.weights} /> : null}

      {!loadingClasses && !classes.length ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes yet"
          hint={
            isTeacher
              ? "An administrator assigns classes to you."
              : "Create classes in School Admin."
          }
        />
      ) : book.isLoading || loadingClasses ? (
        <ListSkeleton rows={5} />
      ) : book.isError ? (
        <p className="text-sm text-destructive">{authErrorMessage(book.error)}</p>
      ) : book.data ? (
        <GradebookTable data={book.data} />
      ) : null}
    </>
  );
}

function cellText(cell: GradebookData["rows"][number]["cells"][string] | undefined) {
  if (!cell) return "";
  if (cell.status === "marked") return pct(cell.percent);
  if (cell.status === "missing") return "missing";
  if (cell.status === "returned") return "returned";
  return "to mark";
}

function exportCsv(data: GradebookData) {
  const header = [
    "Student",
    ...data.columns.map((c) => `${c.title}${c.max ? ` (/${c.max})` : ""}`),
    "Average %",
    "Grade",
    "Missing",
  ];
  const lines = data.rows.map((r) => [
    r.student_name,
    ...data.columns.map((c) => {
      const cell = r.cells[c.id];
      return cell?.status === "marked" ? (cell.score ?? "") : cellText(cell);
    }),
    r.average ?? "",
    r.grade ?? "",
    r.missing,
  ]);
  const blob = new Blob([`${BOM}${toCsv([header, ...lines])}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.class.name.replace(/[^\w-]+/g, "_")}${data.period ? `_${data.period.name.replace(/[^\w-]+/g, "_")}` : ""}_gradebook.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function GradebookTable({ data }: { data: GradebookData }) {
  if (!data.rows.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No learners in this class yet"
        hint="Enrol students in School Admin, or import them in bulk."
      />
    );
  }
  if (!data.columns.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No marked work in this period"
        hint="Assignments and published assessments appear here once they are set."
      />
    );
  }
  return (
    <Panel
      title={`${data.class.name}${data.period ? ` · ${data.period.name}` : ""}`}
      description="Averages count marked work only. Missing work is shown, not counted as zero."
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-card py-2 pr-4 font-medium">Learner</th>
              {data.columns.map((c) => (
                <th key={c.id} className="max-w-[9rem] px-2 py-2 font-medium" title={c.title}>
                  <span className="block truncate">{c.title}</span>
                  <span className="font-normal">
                    {c.kind === "assessment" ? "Test" : "Work"}
                    {c.max ? ` · /${c.max}` : ""}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Average</th>
              <th className="px-2 py-2 font-medium">Grade</th>
              <th className="px-2 py-2" data-print-hide />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.student_id} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-card py-2 pr-4 font-medium">
                  {r.student_name}
                  {r.missing ? (
                    <Badge variant="destructive" className="ml-2 align-middle text-[10px]">
                      {r.missing} missing
                    </Badge>
                  ) : null}
                </td>
                {data.columns.map((c) => {
                  const cell = r.cells[c.id];
                  return (
                    <td
                      key={c.id}
                      className={
                        cell?.status === "missing"
                          ? "px-2 py-2 text-destructive"
                          : cell?.status === "marked"
                            ? "px-2 py-2 tabular-nums"
                            : "px-2 py-2 text-muted-foreground"
                      }
                    >
                      {cellText(cell) || "—"}
                    </td>
                  );
                })}
                <td className="px-2 py-2 font-semibold tabular-nums">{pct(r.average)}</td>
                <td className="px-2 py-2 font-semibold">{r.grade ?? "—"}</td>
                <td className="px-2 py-2" data-print-hide>
                  <Link
                    to="/grades"
                    search={{ student: r.student_id }}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Report card
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Report card (student, parent, staff)                                */
/* ------------------------------------------------------------------ */

function ParentReports() {
  const children = useMyChildrenForReports(true);
  const [childId, setChildId] = useState<string | null>(null);
  useEffect(() => {
    if (!childId && children.data?.[0]) setChildId(children.data[0].id);
  }, [children.data, childId]);
  if (children.isLoading) return <ListSkeleton rows={4} />;
  if (!children.data?.length) {
    return (
      <>
        <PageHeader title="Report cards" subtitle="Your child's term results." />
        <EmptyState
          icon={GraduationCap}
          title="No child linked yet"
          hint="Ask the school to link your child to your account."
        />
      </>
    );
  }
  return (
    <>
      {children.data.length > 1 ? (
        <div className="mb-3" data-print-hide>
          <ChipGroup
            label="Child"
            value={childId}
            onChange={setChildId}
            options={children.data.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      ) : null}
      {childId ? <ReportCardScreen studentId={childId} /> : null}
    </>
  );
}

function ReportCardScreen({ studentId }: { studentId: string }) {
  const [periodId, setPeriodId] = useState<string | null>(null);
  const report = useStudentReportCard(studentId, periodId);
  const r = report.data;

  return (
    <>
      <div data-print-hide>
        <PageHeader
          title="Report card"
          subtitle="Marks update as work is marked; test scores appear once the teacher releases them."
          action={
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-4" /> Print / save PDF
            </Button>
          }
        />
        <div className="mb-4">
          <TermSelect periods={r?.periods ?? []} value={periodId} onChange={setPeriodId} />
        </div>
      </div>

      {report.isLoading ? (
        <ListSkeleton rows={5} />
      ) : report.isError ? (
        <p className="text-sm text-destructive">{authErrorMessage(report.error)}</p>
      ) : r ? (
        <article className="rounded-3xl border border-border bg-card p-5 sm:p-8 print:rounded-none print:border-0 print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {r.school.name}
              </p>
              <h2 className="font-display text-2xl font-bold">{r.student.name}</h2>
              <p className="text-sm text-muted-foreground">
                {r.period
                  ? `${r.period.name} · ${formatDate(r.period.starts_on)} – ${formatDate(r.period.ends_on)}`
                  : "All work to date"}
                {r.student.code ? ` · ID ${r.student.code}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Overall</p>
              <p className="font-display text-3xl font-bold tabular-nums">{pct(r.overall)}</p>
              {r.grade ? (
                <p className="text-sm font-medium">
                  Grade {r.grade.grade} · {r.grade.label}
                </p>
              ) : null}
            </div>
          </header>

          {r.subjects.length ? (
            <div className="-mx-2 mt-4 overflow-x-auto px-2">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Subject / class</th>
                    <th className="px-2 py-2 font-medium">Assignments</th>
                    <th className="px-2 py-2 font-medium">Tests</th>
                    <th className="px-2 py-2 font-medium">Overall</th>
                    <th className="px-2 py-2 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {r.subjects.map((s) => (
                    <tr key={s.class_id} className="border-t border-border align-top">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{s.subject ?? s.class_name}</p>
                        {s.subject ? (
                          <p className="text-xs text-muted-foreground">{s.class_name}</p>
                        ) : null}
                        {s.missing ? (
                          <p className="text-xs text-destructive">{s.missing} missing</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {pct(s.assignments.average)}
                        <span className="block text-xs text-muted-foreground">
                          {s.assignments.marked}/{s.assignments.set} marked
                        </span>
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {pct(s.assessments.average)}
                        <span className="block text-xs text-muted-foreground">
                          {s.assessments.marked}/{s.assessments.set} released
                        </span>
                      </td>
                      <td className="px-2 py-2 font-semibold tabular-nums">{pct(s.overall)}</td>
                      <td className="px-2 py-2 font-semibold">{s.grade?.grade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              No marked work for this period yet.
            </p>
          )}

          <section className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-5">
            <div className="sm:col-span-1">
              <p className="text-xs text-muted-foreground">Attendance</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {r.attendance.rate === null ? "—" : `${r.attendance.rate}%`}
              </p>
            </div>
            {(
              [
                ["Present", r.attendance.present],
                ["Late", r.attendance.late],
                ["Absent", r.attendance.absent],
                ["Excused", r.attendance.excused],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <CommentBox
              title="Class teacher's comment"
              text={r.comments.teacher}
              by={r.comments.teacher_by}
              canEdit={r.can_comment.teacher}
              studentId={r.student.id}
              periodId={periodId}
              kind="teacher"
            />
            <CommentBox
              title="Head teacher's comment"
              text={r.comments.head}
              by={r.comments.head_by}
              canEdit={r.can_comment.head}
              studentId={r.student.id}
              periodId={periodId}
              kind="head"
            />
          </section>

          <footer className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
            Grades: A 80%+ · B 70%+ · C 60%+ · D 50%+ · E below 50%.{" "}
            {r.weights
              ? `Overall = coursework ${r.weights.coursework}% + tests ${r.weights.tests}%.`
              : "Overall = average of all marked work."}{" "}
            Generated {formatDate(r.generated_at)} on Memskool.
          </footer>
        </article>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Comments and weighting (Phase 6)                                    */
/* ------------------------------------------------------------------ */

function CommentBox(props: {
  title: string;
  text: string | null;
  by: string | null;
  canEdit: boolean;
  studentId: string;
  periodId: string | null;
  kind: "teacher" | "head";
}) {
  const save = useSaveReportComment();
  const [draft, setDraft] = useState(props.text ?? "");
  useEffect(() => setDraft(props.text ?? ""), [props.text]);
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{props.title}</p>
      {props.canEdit ? (
        <div className="mt-1 space-y-2 print:hidden">
          <Textarea
            rows={3}
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a short comment for this learner and their family"
          />
          <Button
            size="sm"
            className="rounded-full"
            disabled={save.isPending || draft === (props.text ?? "")}
            onClick={() =>
              save.mutate(
                {
                  student_id: props.studentId,
                  period_id: props.periodId,
                  kind: props.kind,
                  text: draft,
                },
                {
                  onSuccess: () => toast.success("Comment saved"),
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              )
            }
          >
            Save comment
          </Button>
        </div>
      ) : null}
      <p
        className={
          props.canEdit
            ? "hidden whitespace-pre-wrap text-sm print:block"
            : "mt-1 whitespace-pre-wrap text-sm"
        }
      >
        {props.text || "—"}
      </p>
      {props.by && props.text ? (
        <p className="mt-1 text-xs text-muted-foreground">— {props.by}</p>
      ) : null}
    </div>
  );
}

function WeightsControl({ current }: { current: { coursework: number; tests: number } | null }) {
  const set = useSetGradingWeights();
  const [coursework, setCoursework] = useState(String(current?.coursework ?? 40));
  const c = Math.round(Number(coursework));
  const valid = Number.isFinite(c) && c >= 0 && c <= 100;
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm"
      data-print-hide
    >
      <span className="text-muted-foreground">School weighting:</span>
      <span className="font-medium">
        {current
          ? `coursework ${current.coursework}% · tests ${current.tests}%`
          : "plain average of all marked work"}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Coursework %</span>
        <Input
          type="number"
          min={0}
          max={100}
          value={coursework}
          onChange={(e) => setCoursework(e.target.value)}
          className="h-8 w-20"
          aria-label="Coursework percent"
        />
        <span className="text-xs text-muted-foreground">tests {valid ? 100 - c : "—"}%</span>
        <Button
          size="sm"
          className="rounded-full"
          disabled={!valid || set.isPending}
          onClick={() =>
            set.mutate(
              { coursework: c, tests: 100 - c },
              {
                onSuccess: () => toast.success("Weighting saved for the whole school"),
                onError: (e) => toast.error(authErrorMessage(e)),
              },
            )
          }
        >
          Save
        </Button>
        {current ? (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            disabled={set.isPending}
            onClick={() =>
              set.mutate(
                { clear: true },
                {
                  onSuccess: () => toast.success("Back to a plain average"),
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              )
            }
          >
            Use plain average
          </Button>
        ) : null}
      </span>
    </div>
  );
}
