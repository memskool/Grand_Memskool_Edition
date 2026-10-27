import { createFileRoute } from "@tanstack/react-router";
import { HomePublicShell } from "@/components/app/HomePublicShell";
import { HomeFeed } from "@/components/app/HomeFeed";

export const Route = createFileRoute("/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Home — educational short videos — Memskool" },
      {
        name: "description",
        content:
          "Free educational short videos from Memskool teachers and schools. No subscription required.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <HomePublicShell fullBleed>
      <HomeFeed />
    </HomePublicShell>
  );
}
