import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton, PageHeader, Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRole, useSession } from "@/hooks/useAuth";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { useHomeModeration, useModerateHome, useResolveHomeReport } from "@/lib/home-data";

export const Route = createFileRoute("/_authenticated/home-admin")({
  component: HomeAdminPage,
});

function HomeAdminPage() {
  const { user } = useSession();
  const role = useRole(user);
  const queue = useHomeModeration();
  const moderate = useModerateHome();
  const resolve = useResolveHomeReport();
  const [note, setNote] = useState("");

  if (role.data && role.data !== "superadmin") {
    return (
      <EmptyState
        icon={Shield}
        title="Platform operators only"
        hint="Home moderation is limited to superadmin accounts."
      />
    );
  }

  const pending =
    (
      queue.data as
        | { pending?: Array<{ id: string; title: string; creator_name: string; subject: string }> }
        | undefined
    )?.pending ?? [];
  const reports =
    (
      queue.data as
        | { reports?: Array<{ id: string; video_id: string; reason: string; title?: string }> }
        | undefined
    )?.reports ?? [];

  return (
    <>
      <PageHeader
        title="Home review"
        subtitle="Approve educational clips. Unpublished media stays private."
      />
      <Panel title="Pending videos">
        {queue.isLoading ? (
          <ListSkeleton rows={3} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Queue is clear"
            hint="Submitted Home videos appear here."
          />
        ) : (
          <ul className="space-y-4">
            {pending.map((video) => (
              <li key={video.id} className="rounded-xl bg-secondary/50 p-4">
                <p className="font-medium">{video.title}</p>
                <p className="text-xs text-muted-foreground">
                  {video.creator_name} · {video.subject}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      moderate.mutate(
                        { videoId: video.id, decision: "approve" },
                        {
                          onSuccess: () => toast.success("Published"),
                          onError: (error) => toast.error(authErrorMessage(error)),
                        },
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      moderate.mutate(
                        { videoId: video.id, decision: "reject", note },
                        {
                          onSuccess: () => toast.success("Rejected"),
                          onError: (error) => toast.error(authErrorMessage(error)),
                        },
                      )
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      moderate.mutate(
                        { videoId: video.id, decision: "remove" },
                        {
                          onSuccess: () => toast.success("Removed"),
                          onError: (error) => toast.error(authErrorMessage(error)),
                        },
                      )
                    }
                  >
                    Takedown
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          className="mt-4"
          placeholder="Optional rejection note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Panel>
      <Panel title="Open reports" className="mt-6">
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open reports.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{row.title ?? row.video_id}</p>
                  <p className="text-xs text-muted-foreground">{row.reason.replaceAll("_", " ")}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      moderate.mutate(
                        { videoId: row.video_id, decision: "remove" },
                        { onError: (error) => toast.error(authErrorMessage(error)) },
                      )
                    }
                  >
                    Takedown
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resolve.mutate(row.id, {
                        onError: (error) => toast.error(authErrorMessage(error)),
                      })
                    }
                  >
                    Close
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
