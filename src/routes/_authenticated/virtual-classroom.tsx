import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Video, Users } from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import { useMyEnrolledClasses, useTeachingClasses } from "@/lib/school-data";
import { useActiveSession, useStartSession } from "@/lib/classroom-data";
import { ClassroomRoom } from "@/components/app/ClassroomRoom";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/virtual-classroom")({
  head: () => ({
    meta: [
      { title: "Virtual Classroom — Memskool" },
      {
        name: "description",
        content: "Join live lessons with video, chat, raise-hand and automatic attendance in the Memskool virtual classroom.",
      },
      { property: "og:title", content: "Virtual Classroom — Memskool" },
      { property: "og:description", content: "Live lessons with video, chat and automatic attendance." },
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

  const [openClass, setOpenClass] = useState<{ id: string; name: string } | null>(null);

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
          <ul className="grid gap-3 sm:grid-cols-2">
            {source.data.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.subject?.name ?? "General"}
                    {c.room ? ` · ${c.room}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  onClick={() => setOpenClass({ id: c.id, name: c.name })}
                >
                  <Video className="size-4" /> {isTeacher ? "Start" : "Join"}
                </Button>
              </li>
            ))}
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
