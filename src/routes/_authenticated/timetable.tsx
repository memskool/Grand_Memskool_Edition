import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlarmClock, BellRing, CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useAuth";
import {
  useWeeklyTimetable,
  useStudyReminders,
  useCreateStudyReminder,
  useToggleStudyReminder,
  useDeleteStudyReminder,
} from "@/lib/discovery-data";
import { useSubjects } from "@/lib/content-data";
import { WeeklyTimetable } from "@/components/app/WeeklyTimetable";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAYS, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => ({
    meta: [
      { title: "Timetable & Study Reminders — Memskool" },
      {
        name: "description",
        content:
          "See your live weekly class schedule with teachers and subjects, and set personal reading reminders.",
      },
      { property: "og:title", content: "Timetable & Study Reminders — Memskool" },
      {
        property: "og:description",
        content: "A synchronised weekly timetable plus your own study alarm planner.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimetablePage,
});

function TimetablePage() {
  const { user } = useSession();
  const timetable = useWeeklyTimetable(user?.id);
  const reminders = useStudyReminders(user?.id);
  const subjects = useSubjects();
  const create = useCreateStudyReminder(user?.id);
  const toggle = useToggleStudyReminder();
  const remove = useDeleteStudyReminder();

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("none");
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:00");
  const [lead, setLead] = useState("10");

  const addReminder = async () => {
    if (!title.trim()) {
      toast.error("Give your study session a name");
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        subject_id: subjectId === "none" ? null : subjectId,
        day_of_week: Number(day),
        start_time: start,
        end_time: end || null,
        remind_minutes_before: Number(lead) || 0,
      });
      setTitle("");
      toast.success("Study reminder set");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save reminder");
    }
  };

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle="Your class schedule stays in sync automatically — plus your own reading plan."
      />

      <div className="space-y-6">
        <Panel title="Weekly class timetable" description="Live from your school's schedule">
          <WeeklyTimetable slots={timetable.data ?? []} loading={timetable.isLoading} />
        </Panel>

        <Panel
          title="Personal reading timetable"
          description="Set study alarms for your own revision sessions"
        >
          <div className="grid gap-3 rounded-2xl bg-secondary/40 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="rm-title">Session</Label>
              <Input
                id="rm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Revise algebra"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General</SelectItem>
                  {(subjects.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-start">Start</Label>
              <Input
                id="rm-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-end">End</Label>
              <Input id="rm-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-lead">Alarm (min before)</Label>
              <Input
                id="rm-lead"
                type="number"
                min={0}
                value={lead}
                onChange={(e) => setLead(e.target.value)}
              />
            </div>
            <div className="flex items-end lg:col-span-2">
              <Button onClick={addReminder} disabled={create.isPending} className="w-full">
                <Plus className="size-4" /> Add reminder
              </Button>
            </div>
          </div>

          <div className="mt-4">
            {reminders.isLoading ? (
              <ListSkeleton rows={2} />
            ) : reminders.data?.length ? (
              <ul className="space-y-2">
                {reminders.data.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                  >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <AlarmClock className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {DAYS[r.day_of_week]} · {formatTime(r.start_time)}
                        {r.end_time ? ` – ${formatTime(r.end_time)}` : ""}
                        {r.subject?.name ? ` · ${r.subject.name}` : ""}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BellRing className="size-3" /> Alarm {r.remind_minutes_before} min before
                      </p>
                    </div>
                    <Switch
                      checked={r.active}
                      onCheckedChange={(active) => toggle.mutate({ id: r.id, active })}
                      aria-label="Toggle reminder"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete reminder"
                      onClick={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No study sessions planned"
                hint="Add your first reading slot above and Memskool will keep it on your weekly plan."
              />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
