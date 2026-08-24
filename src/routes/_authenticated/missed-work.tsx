import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ClipboardList,
  Lock,
  CheckCircle2,
  FileText,
  Film,
  AudioLines,
  Download,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import { useMyAssignments } from "@/lib/school-data";
import {
  useMissedWork,
  useMarkReviewed,
  useReleaseToLocker,
  type MissedWorkItem,
} from "@/lib/content-data";
import { useUpdateMissedWork } from "@/features/academic/academic-data";
import { downloadObject } from "@/lib/storage";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AskAiButton } from "@/components/app/AskAiButton";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/missed-work")({
  head: () => ({
    meta: [
      { title: "Missed Work — Memskool" },
      {
        name: "description",
        content:
          "Catch up on lessons you missed: notes, videos and recordings routed automatically after an absence, plus overdue assignments.",
      },
      { property: "og:title", content: "Missed Work — Memskool" },
      { property: "og:description", content: "Everything you missed, waiting to be reviewed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissedWorkPage,
});

const CATEGORY_ICON = { note: FileText, video: Film, audio: AudioLines } as const;

function MissedWorkPage() {
  const { user } = useSession();
  const { data: role } = useRole(user);
  // Review + release is a teacher/admin decision; students can only view and open.
  const canReview = role === "teacher" || role === "admin";
  const missed = useMissedWork(user?.id);
  const assignments = useMyAssignments(user?.id);
  const markReviewed = useMarkReviewed();
  const release = useReleaseToLocker(user?.id);
  const progress = useUpdateMissedWork();

  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      (missed.data ?? []).filter((item) => (tab === "pending" ? !item.reviewed : item.reviewed)),
    [missed.data, tab],
  );

  const now = Date.now();
  const overdue = (assignments.data ?? []).filter((a) => {
    const submitted = (a.submissions ?? []).some((s) => s.student_id === user?.id);
    return !submitted && a.due_at && new Date(a.due_at).getTime() < now;
  });

  const open = async (item: MissedWorkItem) => {
    try {
      if (item.file_path) {
        await downloadObject("library-files", item.file_path, item.file_name);
      } else if (item.url) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
      if (!item.reviewed && canReview) {
        setPendingId(item.id);
        await markReviewed.mutateAsync(item.id);
        toast.success("Marked as reviewed — you can now move it to your locker");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open that resource");
    } finally {
      setPendingId(null);
    }
  };

  const review = async (item: MissedWorkItem) => {
    setPendingId(item.id);
    try {
      await markReviewed.mutateAsync(item.id);
      toast.success("Marked as reviewed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that item");
    } finally {
      setPendingId(null);
    }
  };

  const moveToLocker = async (item: MissedWorkItem) => {
    setPendingId(item.id);
    try {
      await release.mutateAsync(item);
      toast.success("Moved into your locker");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move that item");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Missed Work"
        subtitle="Lesson resources routed here automatically whenever you're marked absent."
        action={
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="pending">To review</TabsTrigger>
              <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <Panel
        title={tab === "pending" ? "Waiting for you" : "Reviewed catch-up"}
        description={
          tab === "pending"
            ? "Locked to this folder until your teacher reviews them"
            : "Ready to move into your main locker"
        }
        className="mb-5"
      >
        {missed.isLoading ? (
          <ListSkeleton />
        ) : items.length ? (
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon =
                CATEGORY_ICON[(item.category as keyof typeof CATEGORY_ICON) ?? "note"] ?? FileText;
              const working = pendingId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[item.class?.name, `Lesson ${formatDate(item.lesson_date)}`, item.status]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {item.reviewed ? (
                    <Badge variant="secondary" className="rounded-full">
                      <CheckCircle2 className="size-3.5" /> Reviewed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full">
                      <Lock className="size-3.5" /> Locked
                    </Badge>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <AskAiButton missedWorkId={item.id} intent="MISSED_WORK_HELP" label="Ask AI" />
                    {item.file_path || item.url ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={working}
                        onClick={() => void open(item)}
                      >
                        <Download className="size-4" /> Open
                      </Button>
                    ) : null}
                    {!canReview ? null : !item.reviewed ? (
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={working}
                        onClick={() => void review(item)}
                      >
                        Mark as reviewed
                      </Button>
                    ) : !item.released_to_locker ? (
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={working}
                        onClick={() => void moveToLocker(item)}
                      >
                        <ArrowRightLeft className="size-4" /> Move to locker
                      </Button>
                    ) : (
                      <Badge className="rounded-full">In your locker</Badge>
                    )}
                    {!canReview && item.status !== "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={working}
                        onClick={() =>
                          progress.mutate(
                            {
                              id: item.id,
                              status: item.status === "in_progress" ? "completed" : "in_progress",
                            },
                            {
                              onError: (e) =>
                                toast.error(e instanceof Error ? e.message : "Could not update"),
                            },
                          )
                        }
                      >
                        {item.status === "in_progress" ? "Mark completed" : "Start"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={tab === "pending" ? ClipboardList : CheckCircle2}
            title={tab === "pending" ? "Nothing to catch up on" : "No reviewed items yet"}
            hint={
              tab === "pending"
                ? "When you're marked absent, that lesson's notes, videos and recordings land here."
                : "Review a locked item to unlock moving it into your locker."
            }
          />
        )}
      </Panel>

      <Panel title="Overdue assignments" description="Hand these in as soon as you can">
        {assignments.isLoading ? (
          <ListSkeleton rows={2} />
        ) : overdue.length ? (
          <ul className="space-y-2">
            {overdue.map((a) => (
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
        <AlertCircle className="size-3.5" /> Missed-work files stay locked here until you open them
        or mark them as reviewed.
      </p>
    </>
  );
}
