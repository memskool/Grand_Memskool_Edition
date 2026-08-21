import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Video, Users } from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import { useMyEnrolledClasses, useTeachingClasses } from "@/lib/school-data";
import { useActiveSession, useStartSession, useLiveSessions } from "@/lib/classroom-data";
import { ClassroomRoom } from "@/components/app/ClassroomRoom";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { SuspensionNotice } from "@/components/app/SuspensionNotice";
import { useSuspensionStatus } from "@/lib/discipline-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/virtual-classroom")({
  head: () => ({
    meta: [
      { title: "Virtual Classroom — Memskool" },
      {
        name: "description",
        content:
          "Join live lessons with video, chat, raise-hand and automatic attendance in the Memskool virtual classroom.",
      },
      { property: "og:title", content: "Virtual Classroom — Memskool" },
      {
        property: "og:description",
        content: "Live lessons with video, chat and automatic attendance.",
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
  const isTeacher = role === "teacher" || role === "admin";
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
        subtitle={isTeacher ? "Start a live session for your classes." : "Join your live lessons."}
      />
      <Panel title="Your rooms" description="Each class has its own persistent room">
        {source.isLoading ? (
          <ListSkeleton />
        ) : source.data?.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {source.data.map((c) => {
              const live = liveIds.has(c.id);
              return (
                <li
                  key={c.id}
                  className="flex min-h-[148px] flex-col justify-between gap-4 rounded-3xl bg-ink p-5 text-ink-foreground"
                  style={{ boxShadow: "var(--shadow-soft)" }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                        {c.subject?.name ?? "General"}
                      </p>
                      {live ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                          <span className="size-1.5 animate-pulse rounded-full bg-ink" /> Live
                        </span>
                      ) : null}
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
                        : "No live lesson"}
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
  const start = useStartSession();

  if (session.isLoading) return <ListSkeleton rows={4} />;

  if (!session.data) {
    return (
      <>
        <PageHeader title={className} subtitle="No live session right now." />
        <Panel title="Room is idle" description="Sessions stay closed until a teacher starts one">
          <div className="flex flex-wrap gap-2">
            {isTeacher ? (
              <Button
                className="rounded-full"
                disabled={start.isPending}
                onClick={() =>
                  start.mutate(
                    { classId, hostId: userId, title: className },
                    {
                      onSuccess: () => toast.success("Session started"),
                      onError: (e) => toast.error((e as Error).message),
                    },
                  )
                }
              >
                <Video className="size-4" /> Start session
              </Button>
            ) : null}
            <Button variant="outline" className="rounded-full" onClick={onExit}>
              Back to rooms
            </Button>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <ClassroomRoom
      session={session.data}
      className={className}
      userId={userId}
      isTeacher={isTeacher}
      onExit={onExit}
    />
  );
}
