import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Video, Users } from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import { useMyEnrolledClasses, useTeachingClasses } from "@/lib/school-data";
import {
  useActiveSession,
  useMyParticipation,
  useRecentSession,
  useStartSession,
  useLiveSessions,
} from "@/lib/classroom-data";
import { useLessonsForClass } from "@/features/academic/academic-data";
import { AskAiButton } from "@/components/app/AskAiButton";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { SuspensionNotice } from "@/components/app/SuspensionNotice";
import { useSuspensionStatus } from "@/lib/discipline-data";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authErrorMessage } from "@/lib/errors/auth-errors";

const ClassroomRoom = lazy(() =>
  import("@/components/app/ClassroomRoom").then((m) => ({ default: m.ClassroomRoom })),
);

export const Route = createFileRoute("/_authenticated/virtual-classroom")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Virtual Classroom — Memskool" },
      {
        name: "description",
        content:
          "Join live lessons with video, chat, raise-hand and attendance in the Memskool virtual classroom.",
      },
      { property: "og:title", content: "Virtual Classroom — Memskool" },
      {
        property: "og:description",
        content: "Live lessons with video, chat and attendance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VirtualClassroomPage,
});

function VirtualClassroomPage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);
  const isTeacher = role === "teacher" || role === "admin" || role === "institution";
  const enrolled = useMyEnrolledClasses(isTeacher ? undefined : user?.id);
  const teaching = useTeachingClasses(isTeacher ? user?.id : undefined);
  const source = isTeacher ? teaching : enrolled;

  const { suspension } = useSuspensionStatus(user?.id);
  const classIds = (source.data ?? []).map((c) => c.id);
  const liveSessions = useLiveSessions(classIds);
  const liveIds = new Set((liveSessions.data ?? []).map((s) => s.class_id));

  const [openClass, setOpenClass] = useState<{ id: string; name: string } | null>(null);

  if (suspension && !isTeacher) {
    return (
      <>
        <PageHeader title="Virtual Classroom" subtitle="Live lessons" />
        <SuspensionNotice suspension={suspension} feature="Live Classroom" />
      </>
    );
  }

  if (openClass && user) {
    return (
      <RoomLoader
        classId={openClass.id}
        className={openClass.name}
        userId={user.id}
        isTeacher={isTeacher}
        onExit={() => setOpenClass(null)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Virtual Classroom"
        subtitle={
          isTeacher
            ? "Start a live session for a class you teach. Students only join when the session is live."
            : "Join a class when your teacher has started it."
        }
      />
      <Panel
        title="Your rooms"
        description="Each class has its own live room, tied to the timetable and lessons"
      >
        {source.isLoading ? (
          <ListSkeleton />
        ) : source.data?.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {source.data.map((c) => {
              const live = liveIds.has(c.id);
              return (
                <li
                  key={c.id}
                  className="flex min-h-[148px] flex-col justify-between gap-4 rounded-3xl bg-ink p-5 text-ink-foreground gold-hairline"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                        {c.subject?.name ?? "General"}
                      </p>
                      {live ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-foreground">
                          <span className="size-1.5 animate-pulse rounded-full bg-gold-foreground" /> Live
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                          Upcoming / idle
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-display text-lg font-bold">{c.name}</p>
                    {c.room ? <p className="text-xs text-ink-muted">{c.room}</p> : null}
                  </div>
                  <Button
                    size="sm"
                    className="w-fit rounded-full bg-ink-foreground text-ink hover:bg-ink-foreground/90"
                    disabled={!isTeacher && !live}
                    onClick={() => setOpenClass({ id: c.id, name: c.name })}
                  >
                    <Video className="size-4" />{" "}
                    {isTeacher
                      ? live
                        ? "Rejoin session"
                        : "Start session"
                      : live
                        ? "Join live lesson"
                        : "Not live yet"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Users}
            title="No classrooms yet"
            hint="Rooms appear here once you are enrolled in or assigned to a class."
          />
        )}
      </Panel>
    </>
  );
}

function RoomLoader({
  classId,
  className,
  userId,
  isTeacher,
  onExit,
}: {
  classId: string;
  className: string;
  userId: string;
  isTeacher: boolean;
  onExit: () => void;
}) {
  const session = useActiveSession(classId);
  const recent = useRecentSession(classId);
  const lessons = useLessonsForClass(classId);
  const start = useStartSession();
  const [lessonId, setLessonId] = useState<string>("none");
  const mine = useMyParticipation(
    recent.data && !recent.data.is_active ? recent.data.id : undefined,
    isTeacher ? undefined : userId,
  );

  if (session.isLoading) return <ListSkeleton rows={4} />;

  if (session.data) {
    return (
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ClassroomRoom
          session={session.data}
          className={className}
          userId={userId}
          isTeacher={isTeacher}
          onExit={onExit}
        />
      </Suspense>
    );
  }

  const last = recent.data && !recent.data.is_active ? recent.data : null;
  const missed =
    !isTeacher &&
    last &&
    last.status !== "cancelled" &&
    !mine.isLoading &&
    !mine.data?.connected_at;
  const upcoming = (lessons.data ?? []).filter(
    (l) => l.status === "scheduled" || l.status === "draft" || l.status === "in_progress",
  );

  return (
    <>
      <PageHeader title={className} subtitle="No live session right now." />
      <Panel
        title={last?.status === "ended" ? "Last session ended" : "Room is idle"}
        description="Students can join only after a teacher starts the live class"
      >
        {missed ? (
          <div className="mb-4 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
            <p className="font-medium">You missed the last live class.</p>
            <p className="mt-1 text-muted-foreground">
              Follow-up work appears in Missed Work when your teacher assigns it. Lesson materials
              stay available if this session was linked to a lesson.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/missed-work">Open missed work</Link>
              </Button>
              {last.lesson_id ? (
                <AskAiButton lessonId={last.lesson_id} label="Ask AI about the lesson" />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {isTeacher ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={lessonId} onValueChange={setLessonId}>
                <SelectTrigger className="rounded-full sm:max-w-xs" aria-label="Link a lesson">
                  <SelectValue placeholder="Link a lesson (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lesson link</SelectItem>
                  {upcoming.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="rounded-full"
                disabled={start.isPending}
                onClick={() =>
                  start.mutate(
                    {
                      classId,
                      hostId: userId,
                      title: className,
                      lessonId: lessonId === "none" ? null : lessonId,
                    },
                    {
                      onSuccess: () => toast.success("Session started"),
                      onError: (e) => toast.error(authErrorMessage(e)),
                    },
                  )
                }
              >
                <Video className="size-4" /> Start session
              </Button>
            </div>
          ) : null}
          <Button variant="outline" className="w-fit rounded-full" onClick={onExit}>
            Back to rooms
          </Button>
        </div>
      </Panel>
    </>
  );
}
