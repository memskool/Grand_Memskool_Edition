import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/types/academic";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  useClassRoster,
  useLessonsForTeacher,
  useRecordAttendance,
  useAssignMissedWork,
} from "@/features/academic/academic-data";
import { Input } from "@/components/ui/input";

export function AttendanceRecorder({ teacherId }: { teacherId: string }) {
  const lessons = useLessonsForTeacher(teacherId);
  const record = useRecordAttendance();
  const missed = useAssignMissedWork();
  const [lessonId, setLessonId] = useState("");
  const lesson = (lessons.data ?? []).find((l) => l.id === lessonId);
  const roster = useClassRoster(lesson?.class_id);
  const active = (roster.data ?? []).filter((r) => (r.status ?? "active") !== "ended");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [missTitle, setMissTitle] = useState("Catch up on this lesson");

  const defaults = useMemo(() => {
    const next: Record<string, AttendanceStatus> = {};
    for (const r of active) next[r.student_id] = marks[r.student_id] ?? "present";
    return next;
  }, [active, marks]);

  if (lessons.isLoading) {
    return (
      <Panel title="Attendance">
        <ListSkeleton rows={2} />
      </Panel>
    );
  }

  return (
    <Panel
      title="Attendance"
      description="Record presence for a lesson you teach. Absences can receive missed work."
    >
      <Select value={lessonId} onValueChange={setLessonId}>
        <SelectTrigger className="max-w-md">
          <SelectValue placeholder="Select a lesson" />
        </SelectTrigger>
        <SelectContent>
          {(lessons.data ?? []).map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!lessonId ? (
        <EmptyState icon={ClipboardCheck} title="Pick a lesson" />
      ) : roster.isLoading ? (
        <ListSkeleton rows={3} />
      ) : active.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No students enrolled" />
      ) : (
        <ul className="mt-4 space-y-2">
          {active.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm"
            >
              <span>{r.student?.full_name ?? "Student"}</span>
              <Select
                value={defaults[r.student_id] ?? "present"}
                onValueChange={(v) =>
                  setMarks((m) => ({ ...m, [r.student_id]: v as AttendanceStatus }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
      {lessonId && active.length ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            className="rounded-full"
            disabled={record.isPending}
            onClick={() =>
              record.mutate(
                {
                  lesson_id: lessonId,
                  marks: active.map((r) => ({
                    student_id: r.student_id,
                    status: defaults[r.student_id] ?? "present",
                  })),
                },
                {
                  onSuccess: () => toast.success("Attendance saved"),
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              )
            }
          >
            Save attendance
          </Button>
          <Input
            value={missTitle}
            onChange={(e) => setMissTitle(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              const absents = active.filter(
                (r) => (defaults[r.student_id] ?? "present") === "absent",
              );
              if (!absents.length) {
                toast.error("Mark absences first, then assign missed work.");
                return;
              }
              Promise.all(
                absents.map((r) =>
                  missed.mutateAsync({
                    student_id: r.student_id,
                    lesson_id: lessonId,
                    class_id: lesson?.class_id ?? null,
                    subject_id: lesson?.subject_id ?? null,
                    assignment_id: null,
                    material_id: null,
                    title: missTitle.trim() || "Catch up on this lesson",
                  }),
                ),
              )
                .then(() => toast.success("Missed work assigned to absent students"))
                .catch((e) => toast.error(authErrorMessage(e)));
            }}
          >
            Assign missed work to absences
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
