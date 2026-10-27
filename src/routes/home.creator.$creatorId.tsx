import { Link, createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { HomePublicShell } from "@/components/app/HomePublicShell";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/app/primitives";
import { useHomeCreatorChannel, homeSubjectLabel } from "@/lib/home-data";

export const Route = createFileRoute("/home/creator/$creatorId")({
  ssr: false,
  component: CreatorPage,
});

function CreatorPage() {
  const { creatorId } = Route.useParams();
  const channel = useHomeCreatorChannel(creatorId);
  if (channel.isLoading) {
    return (
      <HomePublicShell>
        <ListSkeleton rows={4} />
      </HomePublicShell>
    );
  }
  if (!channel.data) {
    return (
      <HomePublicShell>
        <EmptyState
          icon={UserRound}
          title="Creator not found"
          hint="This profile has no public Home videos."
        />
      </HomePublicShell>
    );
  }
  const data = channel.data as {
    creatorName: string;
    videos: Array<{ id: string; title: string; subject: string }>;
  };
  return (
    <HomePublicShell>
      <PageHeader title={data.creatorName} subtitle="Educational creator on Memskool Home" />
      {data.videos.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No published clips"
          hint="Approved videos from this creator will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {data.videos.map((video) => (
            <li key={video.id} className="surface-card p-4">
              <Link to="/home/$videoId" params={{ videoId: video.id }} className="font-medium">
                {video.title}
              </Link>
              <p className="text-xs text-muted-foreground">{homeSubjectLabel(video.subject)}</p>
            </li>
          ))}
        </ul>
      )}
    </HomePublicShell>
  );
}
