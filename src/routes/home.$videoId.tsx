import { createFileRoute } from "@tanstack/react-router";
import { HomePublicShell } from "@/components/app/HomePublicShell";
import { HomeFeed } from "@/components/app/HomeFeed";

export const Route = createFileRoute("/home/$videoId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Home video — Memskool" }],
  }),
  component: HomeVideoRoute,
});

function HomeVideoRoute() {
  const { videoId } = Route.useParams();
  return (
    <HomePublicShell fullBleed>
      <HomeFeed initialVideoId={videoId} />
    </HomePublicShell>
  );
}
