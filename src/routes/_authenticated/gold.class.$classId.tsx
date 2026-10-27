import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GoldLiveRoom } from "@/components/app/GoldLiveRoom";
import { useSession } from "@/hooks/useAuth";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { reconcileOrder } from "@/lib/payments.functions";
import {
  goldSubjectLabel,
  priceLabel,
  useAddGoldResource,
  useCopyGoldToLocker,
  useEndGoldLesson,
  useEnrolGold,
  useGoldClassPage,
  useMyGoldTutor,
  useScheduleGoldLesson,
  useStartGoldLesson,
  useSubmitGoldReview,
} from "@/lib/gold-data";
import type {
  GoldClass,
  GoldEnrolment,
  GoldLesson,
  GoldResource,
  GoldReview,
  GoldTutor,
} from "@/features/gold/types";

type ClassBundle = {
  class: GoldClass;
  tutor: GoldTutor | null;
  enrolment: GoldEnrolment | null;
  lessons: GoldLesson[];
  reviews: GoldReview[];
  resources: GoldResource[];
};

export const Route = createFileRoute("/_authenticated/gold/class/$classId")({
  component: GoldClassPage,
});

function GoldClassPage() {
  const { classId } = Route.useParams();
  const page = useGoldClassPage(classId);
  const { user } = useSession();
  const me = useMyGoldTutor();
  const enrol = useEnrolGold();
  const schedule = useScheduleGoldLesson();
  const start = useStartGoldLesson();
  const end = useEndGoldLesson();
  const addResource = useAddGoldResource();
  const locker = useCopyGoldToLocker();
  const review = useSubmitGoldReview();
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("Live lesson");
  const [lessonStart, setLessonStart] = useState("");
  const [lessonEnd, setLessonEnd] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [rating, setRating] = useState("5");
  const [reviewBody, setReviewBody] = useState("");

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("ref");
    if (!reference) return;
    void reconcileOrder({ data: { reference } })
      .then(() => page.refetch())
      .catch(() => undefined);
  }, [page]);

  const bundle = page.data as ClassBundle | null | undefined;
  const cls = bundle?.class;
  const isTutor = Boolean(user?.id && cls?.tutor_id === user.id);
  const enrolled = bundle?.enrolment?.status === "active";

  if (page.isLoading) return <ListSkeleton rows={5} />;
  if (!cls) {
    return (
      <EmptyState
        icon={Award}
        title="Class not found"
        hint="This Gold class is missing or unpublished."
      />
    );
  }

  return (
    <>
      <PageHeader
        title={cls.title}
        subtitle={`${cls.tutor_name} · independent Gold class, not a school classroom`}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Panel title="About this class">
          <p className="text-sm leading-relaxed">{cls.description}</p>
          <p className="mt-3 text-sm whitespace-pre-wrap">{cls.objectives}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {goldSubjectLabel(cls.subject)} · {goldSubjectLabel(cls.level)} · {cls.delivery} ·{" "}
            {cls.enrolled_count}/{cls.capacity} enrolled
          </p>
          {cls.cancellation_terms ? (
            <p className="mt-3 text-xs text-muted-foreground">{cls.cancellation_terms}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {isTutor ? null : enrolled ? (
              <Button disabled className="rounded-full">
                Enrolled
              </Button>
            ) : (
              <Button
                className="rounded-full"
                disabled={enrol.isPending}
                onClick={() =>
                  enrol.mutate(cls.id, {
                    onSuccess: (result) => {
                      const payload = result as { paymentLink?: string | null };
                      if (payload?.paymentLink) {
                        window.location.assign(payload.paymentLink);
                        return;
                      }
                      toast.success("You are enrolled");
                      void page.refetch();
                    },
                    onError: (error) => toast.error(authErrorMessage(error)),
                  })
                }
              >
                {cls.price_cents > 0
                  ? `Enrol · ${priceLabel(cls.price_cents, cls.currency)}`
                  : "Enrol for free"}
              </Button>
            )}
            {bundle?.tutor ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/gold/tutor/$tutorId" params={{ tutorId: bundle.tutor.id }}>
                  Tutor profile
                </Link>
              </Button>
            ) : null}
          </div>
        </Panel>
        <Panel title="Tutor">
          <p className="font-medium">{cls.tutor_name}</p>
          {me.data?.id === cls.tutor_id ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Pending settlement: {me.data.earnings_currency}{" "}
              {me.data.earnings_pending_cents.toLocaleString()} — not a completed payout.
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel title="Lessons" className="mt-6">
        {isTutor ? (
          <form
            className="mb-4 grid gap-2 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              schedule.mutate(
                {
                  classId: cls.id,
                  title: lessonTitle,
                  startsAt: new Date(lessonStart).toISOString(),
                  endsAt: new Date(lessonEnd).toISOString(),
                },
                {
                  onSuccess: () => toast.success("Lesson scheduled"),
                  onError: (error) => toast.error(authErrorMessage(error)),
                },
              );
            }}
          >
            <Input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} />
            <Input
              type="datetime-local"
              value={lessonStart}
              onChange={(event) => setLessonStart(event.target.value)}
            />
            <Input
              type="datetime-local"
              value={lessonEnd}
              onChange={(event) => setLessonEnd(event.target.value)}
            />
            <Button className="rounded-full" disabled={schedule.isPending}>
              Schedule
            </Button>
          </form>
        ) : null}
        {(bundle?.lessons ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No lessons scheduled yet.</p>
        ) : (
          <ul className="space-y-2">
            {(bundle?.lessons ?? []).map((lesson) => (
              <li
                key={lesson.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lesson.starts_at).toLocaleString()} · {lesson.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isTutor && lesson.status !== "ended" && lesson.status !== "cancelled" ? (
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={start.isPending}
                      onClick={() =>
                        start.mutate(lesson.id, {
                          onSuccess: (result) => {
                            const sessionId = (result as { sessionId?: string }).sessionId;
                            if (sessionId) setLiveSessionId(sessionId);
                            toast.success("Lesson is live");
                          },
                          onError: (error) => toast.error(authErrorMessage(error)),
                        })
                      }
                    >
                      Start
                    </Button>
                  ) : null}
                  {isTutor && lesson.status === "live" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => end.mutate(lesson.id)}
                    >
                      End
                    </Button>
                  ) : null}
                  {(isTutor || enrolled) &&
                  lesson.status === "live" &&
                  lesson.classroom_session_id ? (
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => setLiveSessionId(lesson.classroom_session_id)}
                    >
                      Join
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {liveSessionId ? (
          <div className="mt-4">
            <GoldLiveRoom sessionId={liveSessionId} onLeave={() => setLiveSessionId(null)} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Materials" className="mt-6">
        {isTutor ? (
          <form
            className="mb-4 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addResource.mutate(
                { classId: cls.id, title: resourceTitle, url: resourceUrl || null },
                {
                  onSuccess: () => toast.success("Material added"),
                  onError: (error) => toast.error(authErrorMessage(error)),
                },
              );
            }}
          >
            <Input
              placeholder="Title"
              value={resourceTitle}
              onChange={(event) => setResourceTitle(event.target.value)}
            />
            <Input
              placeholder="https://…"
              value={resourceUrl}
              onChange={(event) => setResourceUrl(event.target.value)}
            />
            <Button className="rounded-full">Add link</Button>
          </form>
        ) : null}
        {(bundle?.resources ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {enrolled || isTutor ? "No materials yet." : "Enrol to see class materials."}
          </p>
        ) : (
          <ul className="space-y-2">
            {(bundle?.resources ?? []).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <div className="flex gap-2">
                  {item.url ? (
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <a href={item.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      locker.mutate(item.id, {
                        onSuccess: () => toast.success("Saved to your Locker"),
                        onError: (error) => toast.error(authErrorMessage(error)),
                      })
                    }
                  >
                    Save to Locker
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Review" className="mt-6">
        {enrolled && bundle?.enrolment?.attended ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              review.mutate(
                { classId: cls.id, rating: Number(rating), body: reviewBody || null },
                {
                  onSuccess: () => toast.success("Review submitted"),
                  onError: (error) => toast.error(authErrorMessage(error)),
                },
              );
            }}
          >
            <Input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            />
            <Textarea
              placeholder="Optional written feedback"
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
            />
            <Button className="rounded-full">Submit review</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Reviews open only after you enrol and join a live lesson.
          </p>
        )}
      </Panel>
    </>
  );
}
