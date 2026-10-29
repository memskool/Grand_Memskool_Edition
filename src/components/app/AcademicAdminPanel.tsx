import { useState } from "react";
import { toast } from "sonner";
import { Archive, BookOpen, GraduationCap, Plus, UserPlus, Users } from "lucide-react";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_LABELS, type PeriodLabel } from "@/types/academic";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { useAllApplications } from "@/lib/discovery-data";
import {
  useAcademicYears,
  useAcademicPeriods,
  useCreateAcademicYear,
  useCreateAcademicPeriod,
  useSetCurrentYear,
  useSetPeriodLabel,
  useCurricula,
  useCurriculumTopics,
  useCurriculumLevels,
  useCreateCurriculum,
  useCreateCurriculumLevel,
  useCreateTopic,
  useSchoolSubjects,
  useCreateSubject,
  useSchoolClasses,
  useCreateAcademicClass,
  useArchiveClass,
  useClassRoster,
  useClassTeachers,
  useEnrollStudent,
  useEndEnrollment,
  useAssignTeacher,
  useEndTeacherAssignment,
  useSchoolStudents,
  useSchoolTeachers,
} from "@/features/academic/academic-data";

export function AcademicStructurePanel({
  schoolId,
  currentYearId,
  periodLabel,
}: {
  schoolId: string | undefined;
  currentYearId?: string | null;
  periodLabel?: string | null;
}) {
  const years = useAcademicYears(schoolId);
  const createYear = useCreateAcademicYear(schoolId);
  const setCurrent = useSetCurrentYear(schoolId);
  const setLabel = useSetPeriodLabel(schoolId);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const label = (periodLabel as PeriodLabel | undefined) ?? "Term";

  return (
    <Panel
      title="Academic calendar"
      description="Years stay attached to classes and lessons. Changing the current year does not rewrite history."
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>What you call a period</Label>
          <Select
            value={label}
            onValueChange={(v) =>
              setLabel.mutate(v as PeriodLabel, {
                onSuccess: () => toast.success("Label updated"),
                onError: (e) => toast.error(authErrorMessage(e)),
              })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_LABELS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="y-name">Year name</Label>
          <Input
            id="y-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2026 / 2027"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="y-start">Starts</Label>
          <Input
            id="y-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="y-end">Ends</Label>
          <Input id="y-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            className="w-full"
            disabled={createYear.isPending}
            onClick={() => {
              if (!name.trim() || !start || !end) {
                toast.error("Name and dates are required");
                return;
              }
              createYear.mutate(
                { name: name.trim(), starts_on: start, ends_on: end },
                {
                  onSuccess: () => {
                    setName("");
                    toast.success("Academic year created");
                  },
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              );
            }}
          >
            <Plus className="size-4" /> Add year
          </Button>
        </div>
      </div>
      <div className="mt-4">
        {years.isLoading ? (
          <ListSkeleton rows={2} />
        ) : years.data?.length ? (
          <ul className="space-y-2">
            {years.data.map((y) => (
              <li
                key={y.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <GraduationCap className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 font-medium">{y.name}</span>
                <span className="text-xs text-muted-foreground">
                  {y.starts_on} – {y.ends_on}
                </span>
                {currentYearId === y.id ? (
                  <Badge>Current</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      setCurrent.mutate(y.id, {
                        onSuccess: () =>
                          toast.success(
                            "Current year updated. Past records stay on their original year.",
                          ),
                        onError: (e) => toast.error(authErrorMessage(e)),
                      })
                    }
                  >
                    Make current
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="No academic years yet"
            hint="Create the year your school is running now."
          />
        )}
      </div>
      <PeriodForm schoolId={schoolId} years={years.data ?? []} label={label} />
    </Panel>
  );
}

function PeriodForm({
  schoolId,
  years,
  label,
}: {
  schoolId: string | undefined;
  years: Array<{ id: string; name: string }>;
  label: PeriodLabel;
}) {
  const create = useCreateAcademicPeriod(schoolId);
  const periods = useAcademicPeriods(schoolId);
  const [yearId, setYearId] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="mb-3 text-sm font-medium">{label}s</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={yearId} onValueChange={setYearId}>
          <SelectTrigger>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${label} 1`} />
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Button
          disabled={create.isPending}
          onClick={() => {
            if (!yearId || !name.trim() || !start || !end) {
              toast.error("Year, name and dates are required");
              return;
            }
            create.mutate(
              {
                academic_year_id: yearId,
                name: name.trim(),
                label,
                starts_on: start,
                ends_on: end,
              },
              {
                onSuccess: () => {
                  setName("");
                  toast.success(`${label} created`);
                },
                onError: (e) => toast.error(authErrorMessage(e)),
              },
            );
          }}
        >
          Add {label.toLowerCase()}
        </Button>
      </div>
      {periods.isLoading ? (
        <ListSkeleton rows={2} />
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {(periods.data ?? []).map((p) => (
            <li key={p.id} className="text-muted-foreground">
              {p.label} · {p.name} ({p.starts_on} – {p.ends_on})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CurriculumPanel({
  schoolId,
  userId,
}: {
  schoolId: string | undefined;
  userId?: string | undefined;
}) {
  const curricula = useCurricula(schoolId);
  const subjects = useSchoolSubjects(schoolId);
  const createCur = useCreateCurriculum(schoolId);
  const createSub = useCreateSubject(schoolId, userId);
  const createTopic = useCreateTopic(schoolId);
  const [curName, setCurName] = useState("");
  const [subName, setSubName] = useState("");
  const [subCode, setSubCode] = useState("");
  const [curId, setCurId] = useState("");
  const topics = useCurriculumTopics(curId || undefined);
  const levels = useCurriculumLevels(curId || undefined);
  const createLevel = useCreateCurriculumLevel(schoolId);
  const [topicName, setTopicName] = useState("");
  const [levelName, setLevelName] = useState("");

  return (
    <div className="space-y-6">
      <Panel
        title="Curricula"
        description="A flexible map: curriculum → subject → topic. National content is not bundled."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={curName}
            onChange={(e) => setCurName(e.target.value)}
            placeholder="e.g. School curriculum 2026"
          />
          <Button
            onClick={() =>
              createCur.mutate(
                { name: curName.trim(), description: null },
                {
                  onSuccess: () => {
                    setCurName("");
                    toast.success("Curriculum created");
                  },
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              )
            }
            disabled={createCur.isPending}
          >
            Add curriculum
          </Button>
        </div>
        {curricula.isLoading ? <ListSkeleton rows={2} /> : null}
        <ul className="mt-3 space-y-1">
          {(curricula.data ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="text-sm font-medium underline-offset-2 hover:underline"
                onClick={() => setCurId(c.id)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        {curId ? (
          <div className="mt-4 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                placeholder="Level or grade (e.g. Senior 4)"
              />
              <Button
                onClick={() =>
                  createLevel.mutate(
                    {
                      curriculum_id: curId,
                      name: levelName.trim(),
                      sort_order: (levels.data?.length ?? 0) + 1,
                    },
                    {
                      onSuccess: () => {
                        setLevelName("");
                        toast.success("Level added");
                      },
                      onError: (e) => toast.error(authErrorMessage(e)),
                    },
                  )
                }
              >
                Add level
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {(levels.data ?? []).map((l) => l.name).join(" · ") || "No levels yet"}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="Topic or subtopic name"
              />
              <Button
                onClick={() =>
                  createTopic.mutate(
                    {
                      curriculum_id: curId,
                      name: topicName.trim(),
                      subject_id: null,
                      parent_id: null,
                      sort_order: (topics.data?.length ?? 0) + 1,
                    },
                    {
                      onSuccess: () => {
                        setTopicName("");
                        toast.success("Topic added");
                      },
                      onError: (e) => toast.error(authErrorMessage(e)),
                    },
                  )
                }
              >
                Add topic
              </Button>
            </div>
          </div>
        ) : null}
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {(topics.data ?? []).map((t) => (
            <li key={t.id}>
              {t.parent_id ? "↳ " : ""}
              {t.name}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Subjects" description="Your school catalogue">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="Mathematics"
          />
          <Input value={subCode} onChange={(e) => setSubCode(e.target.value)} placeholder="MATH" />
          <Button
            onClick={() => {
              if (!subName.trim() || !subCode.trim()) {
                toast.error("Name and code are required");
                return;
              }
              createSub.mutate(
                {
                  name: subName.trim(),
                  code: subCode.trim(),
                  description: null,
                  level: null,
                  curriculum_id: curId || null,
                },
                {
                  onSuccess: () => {
                    setSubName("");
                    setSubCode("");
                    toast.success("Subject added");
                  },
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              );
            }}
          >
            <BookOpen className="size-4" /> Add subject
          </Button>
        </div>
        {subjects.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(subjects.data ?? []).map((s) => (
              <li key={s.id} className="rounded-xl bg-secondary/50 px-4 py-3 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-muted-foreground">{s.code}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function EnrolmentPanel({ schoolId }: { schoolId: string | undefined }) {
  const classes = useSchoolClasses(schoolId);
  const students = useSchoolStudents(schoolId);
  const [classId, setClassId] = useState("");
  const roster = useClassRoster(classId || undefined);
  const teachers = useClassTeachers(classId || undefined);
  const enroll = useEnrollStudent();
  const endEnroll = useEndEnrollment();
  const assign = useAssignTeacher();
  const endAssign = useEndTeacherAssignment();
  const archive = useArchiveClass(schoolId);
  const createClass = useCreateAcademicClass(schoolId);
  const subjects = useSchoolSubjects(schoolId);
  const years = useAcademicYears(schoolId);
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [className, setClassName] = useState("");
  const [yearId, setYearId] = useState("");
  const schoolTeachers = useSchoolTeachers(schoolId);
  const applications = useAllApplications(schoolId);

  const classRows = (classes.data ?? []).filter((c) => c.status !== "archived");
  const studentRows = (() => {
    const byId = new Map<string, { id: string; full_name: string }>();
    for (const student of students.data ?? []) {
      byId.set(student.id, { id: student.id, full_name: student.full_name });
    }
    for (const app of applications.data ?? []) {
      if (app.status !== "approved" || !app.student_id) continue;
      if (byId.has(app.student_id)) continue;
      byId.set(app.student_id, {
        id: app.student_id,
        full_name: app.applicant_name?.trim() || app.email || "Student",
      });
    }
    return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  })();

  return (
    <div className="space-y-6">
      <Panel
        title="Classes"
        description="Create a class, select it, then enrol approved learners from Students & admissions."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Form One A"
          />
          <Select
            value={subjectId || "none"}
            onValueChange={(v) => setSubjectId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Subject (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(subjects.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearId || "none"} onValueChange={(v) => setYearId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Academic year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(years.data ?? []).map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() =>
              createClass.mutate(
                {
                  name: className.trim(),
                  room: null,
                  subject_id: subjectId || null,
                  teacher_id: null,
                  academic_year_id: yearId || null,
                  academic_period_id: null,
                },
                {
                  onSuccess: () => {
                    setClassName("");
                    toast.success("Class created");
                  },
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              )
            }
          >
            Add class
          </Button>
        </div>
        <div className="mt-4 grid gap-2">
          {classRows.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClassId(c.id)}
              className={`rounded-xl px-4 py-3 text-left text-sm ${classId === c.id ? "bg-primary/10" : "bg-secondary/50"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {classId ? (
          <Button
            variant="outline"
            className="mt-3"
            onClick={() =>
              archive.mutate(classId, {
                onSuccess: () => {
                  setClassId("");
                  toast.success("Class archived. Records remain.");
                },
                onError: (e) => toast.error(authErrorMessage(e)),
              })
            }
          >
            <Archive className="mr-2 size-4" /> Archive class
          </Button>
        ) : null}
      </Panel>

      {classId ? (
        <>
          <Panel
            title="Students in this class"
            description="Approve the learner under Students & admissions first, then enrol them here."
          >
            {students.isLoading || applications.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading approved learners…</p>
            ) : studentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approved learners yet. Open Students & admissions, approve the application, then
                return here to pick them from this list.
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentRows.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!studentId || enroll.isPending}
                  onClick={() =>
                    enroll.mutate(
                      { class_id: classId, student_id: studentId },
                      {
                        onSuccess: () => {
                          setStudentId("");
                          toast.success("Student enrolled");
                        },
                        onError: (e) => toast.error(authErrorMessage(e)),
                      },
                    )
                  }
                >
                  <UserPlus className="size-4" /> Enrol
                </Button>
              </div>
            )}
            {roster.isLoading ? (
              <ListSkeleton rows={2} />
            ) : (
              <ul className="mt-3 space-y-2">
                {(roster.data ?? []).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm"
                  >
                    <span>
                      {r.student?.full_name ?? "Student"}{" "}
                      <Badge variant="outline" className="ml-2 capitalize">
                        {r.status ?? "active"}
                      </Badge>
                    </span>
                    {(r.status ?? "active") !== "ended" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          endEnroll.mutate(
                            { enrollment_id: r.id, class_id: classId },
                            { onError: (e) => toast.error(authErrorMessage(e)) },
                          )
                        }
                      >
                        End
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <TeacherAssignBlock
            classId={classId}
            teacherId={teacherId}
            setTeacherId={setTeacherId}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            subjects={subjects.data ?? []}
            teachers={teachers.data ?? []}
            assign={assign}
            endAssign={endAssign}
            schoolId={schoolId}
            schoolTeachers={schoolTeachers.data ?? []}
          />
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="Select a class"
          hint="Then enrol students and assign teachers by subject."
        />
      )}
    </div>
  );
}

function TeacherAssignBlock({
  classId,
  teacherId,
  setTeacherId,
  subjectId,
  setSubjectId,
  subjects,
  teachers,
  assign,
  endAssign,
  schoolId,
  schoolTeachers,
}: {
  classId: string;
  teacherId: string;
  setTeacherId: (v: string) => void;
  subjectId: string;
  setSubjectId: (v: string) => void;
  subjects: Array<{ id: string; name: string }>;
  teachers: Array<{
    id: string;
    teacher_id: string;
    subject_id: string;
    status?: string;
    teacher: { full_name: string } | null;
    subject: { name: string } | null;
  }>;
  assign: ReturnType<typeof useAssignTeacher>;
  endAssign: ReturnType<typeof useEndTeacherAssignment>;
  schoolId: string | undefined;
  schoolTeachers: Array<{ id: string; full_name: string }>;
}) {
  void schoolId;
  return (
    <Panel
      title="Teachers for this class"
      description="A class can have different teachers per subject"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger>
            <SelectValue placeholder="Teacher" />
          </SelectTrigger>
          <SelectContent>
            {schoolTeachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger>
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() =>
            assign.mutate(
              { class_id: classId, teacher_id: teacherId, subject_id: subjectId },
              {
                onSuccess: () => toast.success("Teacher assigned"),
                onError: (e) => toast.error(authErrorMessage(e)),
              },
            )
          }
        >
          Assign
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {teachers.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3 text-sm"
          >
            <span>
              {t.teacher?.full_name ?? "Teacher"} · {t.subject?.name ?? "Subject"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                endAssign.mutate(
                  { assignment_id: t.id, class_id: classId },
                  { onError: (e) => toast.error(authErrorMessage(e)) },
                )
              }
            >
              End
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
