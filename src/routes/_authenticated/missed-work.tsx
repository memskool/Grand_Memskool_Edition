import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ClipboardList } from "lucide-react";
import { useSession } from "@/hooks/useAuth";
import { useMyAssignments } from "@/lib/school-data";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/missed-work")({
  head: () => ({
    meta: [
      { title: "Missed Work — Memskool" },
      {
        name: "description",
        content: "Catch up on overdue assignments and work you still need to hand in on Memskool.",
      },
      { property: "og:title", content: "Missed Work — Memskool" },
      { property: "og:description", content: "Overdue assignments and catch-up work in one list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissedWorkPage,
});

function MissedWorkPage() {
  const { user } = useSession();
  const assignments = useMyAssignments(user?.id);

  const now = Date.now();
  const missed = (assignments.data ?? []).filter((a) => {
    const submitted = (a.submissions ?? []).some((s) => s.student_id === user?.id);
    return !submitted && a.due_at && new Date(a.due_at).getTime() < now;
  });

  return (
    <>
      <PageHeader title="Missed Work" subtitle="Overdue items that still need your attention." />
      <Panel title="Overdue" description="Hand these in as soon as you can">
        {assignments.isLoading ? (
          <ListSkeleton />
        ) : missed.length ? (
          <ul className="space-y-2">
            {missed.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.class?.name}</p>
                </div>
                <Badge variant="destructive" className="shrink-0 rounded-full">
                  Due {formatDate(a.due_at)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Nothing missed"
            hint="You have no overdue work right now — keep it up."
          />
        )}
      </Panel>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="size-3.5" /> Items disappear from this list once a submission is
        recorded.
      </p>
    </>
  );
}
