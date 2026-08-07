import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Target, Compass } from "lucide-react";
import { PageHeader, Panel } from "@/components/app/primitives";

export const Route = createFileRoute("/_authenticated/dream-school")({
  head: () => ({
    meta: [
      { title: "Dream School — Memskool" },
      {
        name: "description",
        content: "Set academic goals and map the path to the school and career you're aiming for.",
      },
      { property: "og:title", content: "Dream School — Memskool" },
      { property: "og:description", content: "Goals, pathways and guidance for your future." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DreamSchoolPage,
});

const CARDS = [
  {
    icon: Target,
    title: "Set your goal",
    body: "Choose the school, course or career you're working towards and Memskool tracks progress against it.",
  },
  {
    icon: Compass,
    title: "Guided pathway",
    body: "See which subjects and grades matter most for your chosen path.",
  },
  {
    icon: Sparkles,
    title: "Readiness score",
    body: "Your attendance, grades and completed work combine into a single readiness signal.",
  },
];

function DreamSchoolPage() {
  return (
    <>
      <PageHeader title="Dream School" subtitle="Plan the future you're studying towards." />
      <Panel title="Coming together" description="Your goal planning workspace">
        <div className="grid gap-3 sm:grid-cols-3">
          {CARDS.map((c) => (
            <div key={c.title} className="rounded-xl bg-secondary/50 p-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="size-4" />
              </span>
              <p className="mt-3 text-sm font-medium">{c.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
