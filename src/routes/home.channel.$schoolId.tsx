import { Link, createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { HomePublicShell } from "@/components/app/HomePublicShell";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useHomeSchoolChannel, homeSubjectLabel } from "@/lib/home-data";

export const Route = createFileRoute("/home/channel/$schoolId")({
  ssr: false,
  component: SchoolChannelPage,
});

function SchoolChannelPage() {
  const { schoolId } = Route.useParams();
  const channel = useHomeSchoolChannel(schoolId);

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
          icon={Building2}
          title="School channel not found"
          hint="This school is not on Memskool Home."
        />
      </HomePublicShell>
    );
  }
  const { school, videos } = channel.data as {
    school: {
      id: string;
      name: string;
      city: string | null;
      country: string | null;
      description: string | null;
      admissions_open: boolean;
    };
    videos: Array<{ id: string; title: string; subject: string; like_count: number }>;
  };

  return (
    <HomePublicShell>
      <PageHeader
        title={school.name}
        subtitle={[school.city, school.country].filter(Boolean).join(", ") || "School channel"}
      />
      {school.description ? (
        <p className="mb-4 text-sm text-muted-foreground">{school.description}</p>
      ) : null}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/dream-school">School applications</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/gold">Gold tutoring</Link>
        </Button>
      </div>
      {videos.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No public videos"
          hint="Approved school clips will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {videos.map((video) => (
            <li key={video.id} className="surface-card p-4">
              <Link to="/home/$videoId" params={{ videoId: video.id }} className="font-medium">
                {video.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {homeSubjectLabel(video.subject)} · {video.like_count} likes
              </p>
            </li>
          ))}
        </ul>
      )}
    </HomePublicShell>
  );
}
