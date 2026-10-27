import { Link, createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { goldSubjectLabel, priceLabel, ratingAverage, useGoldTutorProfile } from "@/lib/gold-data";

export const Route = createFileRoute("/_authenticated/gold/tutor/$tutorId")({
  component: GoldTutorPage,
});

function GoldTutorPage() {
  const { tutorId } = Route.useParams();
  const profile = useGoldTutorProfile(tutorId);
  const tutor = profile.data?.tutor;
  const average = tutor ? ratingAverage(tutor.rating_sum, tutor.rating_count) : null;

  if (profile.isLoading) return <ListSkeleton rows={4} />;
  if (!tutor) {
    return (
      <EmptyState
        icon={Award}
        title="Tutor not found"
        hint="Only approved Gold tutors have a public profile."
      />
    );
  }

  return (
    <>
      <PageHeader
        title={tutor.full_name}
        subtitle="Independent Gold tutor — not a registered school."
      />
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Panel title="Profile">
          <p className="text-sm leading-relaxed">{tutor.bio}</p>
          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">Subjects: </span>
            {tutor.subjects.map(goldSubjectLabel).join(", ")}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Levels: </span>
            {tutor.levels.map(goldSubjectLabel).join(", ")}
          </p>
          <p className="mt-3 text-sm whitespace-pre-wrap">{tutor.qualifications}</p>
        </Panel>
        <Panel title="Reputation">
          <p className="font-display text-3xl font-semibold">{average ?? "—"}</p>
          <p className="text-sm text-muted-foreground">
            {tutor.rating_count} eligible review{tutor.rating_count === 1 ? "" : "s"} from learners
            who attended a lesson. No ratings are invented.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Verified Gold tutor</p>
        </Panel>
      </div>
      <Panel title="Published classes" className="mt-6">
        {(profile.data?.classes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No published classes yet.</p>
        ) : (
          <ul className="space-y-2">
            {(profile.data?.classes ?? []).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {priceLabel(row.price_cents, row.currency)}
                  </p>
                </div>
                <Button asChild className="rounded-full">
                  <Link to="/gold/class/$classId" params={{ classId: row.id }}>
                    View
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
