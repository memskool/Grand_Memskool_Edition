import { createFileRoute } from "@tanstack/react-router";
import { Video, Users } from "lucide-react";
import { useSession, useRole } from "@/hooks/useAuth";
import { useMyEnrolledClasses, useTeachingClasses } from "@/lib/school-data";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/virtual-classroom")({
  head: () => ({
    meta: [
      { title: "Virtual Classroom — Memskool" },
      {
        name: "description",
        content: "Join live lessons and see every class you can attend inside the Memskool virtual classroom.",
      },
      { property: "og:title", content: "Virtual Classroom — Memskool" },
      { property: "og:description", content: "Join live lessons from any device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VirtualClassroomPage,
});

function VirtualClassroomPage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);
  const isTeacher = role === "teacher";
  const enrolled = useMyEnrolledClasses(isTeacher ? undefined : user?.id);
  const teaching = useTeachingClasses(isTeacher ? user?.id : undefined);
  const source = isTeacher ? teaching : enrolled;

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
                <Button size="sm" variant="outline" className="shrink-0 rounded-full">
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
