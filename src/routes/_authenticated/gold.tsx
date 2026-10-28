import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useRole, useSession } from "@/hooks/useAuth";
import { Award, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOLD_LEVELS, GOLD_SUBJECTS } from "@/features/gold/policy";
import {
  goldSubjectLabel,
  priceLabel,
  useApplyGold,
  useGoldDirectory,
  useMyGoldClasses,
  useMyGoldEnrolments,
  useMyGoldTutor,
  useSaveGoldClass,
} from "@/lib/gold-data";
import { authErrorMessage } from "@/lib/errors/auth-errors";

export const Route = createFileRoute("/_authenticated/gold")({
  head: () => ({
    meta: [
      { title: "Gold tutoring — Memskool" },
      {
        name: "description",
        content: "Discover independent tutors and coaching classes on Memskool Gold.",
      },
    ],
  }),
  component: GoldPage,
});

function GoldPage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);
  const canTeach = role === "student" || role === "teacher";
  const directory = useGoldDirectory();
  const mine = useMyGoldTutor();
  const enrolments = useMyGoldEnrolments();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");

  const classes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (directory.data?.classes ?? []).filter((row) => {
      if (subject !== "all" && row.subject !== subject) return false;
      if (!q) return true;
      return [row.title, row.tutor_name, row.subject, row.topic].some((value) =>
        value?.toLowerCase().includes(q),
      );
    });
  }, [directory.data?.classes, query, subject]);

  return (
    <>
      <PageHeader
        title="Gold"
        subtitle="Independent tutoring and coaching — separate from registered schools."
      />
      <Tabs defaultValue="discover" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="learning">My learning</TabsTrigger>
          {canTeach ? <TabsTrigger value="teach">Teach on Gold</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="discover">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search subject, tutor or class"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {GOLD_SUBJECTS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {goldSubjectLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {directory.isLoading ? (
            <ListSkeleton rows={4} />
          ) : classes.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No published Gold classes yet"
              hint="Approved tutors appear here after they publish a class. Nothing is invented."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {classes.map((row) => (
                <li key={row.id} className="surface-card surface-lift space-y-2 p-5">
                  <p className="font-display text-lg font-semibold">{row.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.tutor_name} · {goldSubjectLabel(row.subject)} ·{" "}
                    {goldSubjectLabel(row.level)}
                  </p>
                  <p className="text-sm font-medium">{priceLabel(row.price_cents, row.currency)}</p>
                  <Button asChild variant="gold">
                    <Link to="/gold/class/$classId" params={{ classId: row.id }}>
                      View class
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="learning">
          {enrolments.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (enrolments.data ?? []).length === 0 ? (
            <EmptyState
              icon={Award}
              title="You have not enrolled in a Gold class"
              hint="Discover a tutor, then enrol or pay if the class has a fee."
            />
          ) : (
            <ul className="space-y-2">
              {(enrolments.data ?? []).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">Class {row.class_id.slice(0, 8)}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {row.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/gold/class/$classId" params={{ classId: row.class_id }}>
                      Open
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        {canTeach ? (
          <TabsContent value="teach">
            <TeachGoldPanel status={mine.data?.status ?? null} />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

function TeachGoldPanel({ status }: { status: string | null }) {
  const apply = useApplyGold();
  const save = useSaveGoldClass();
  const classes = useMyGoldClasses();
  const [bio, setBio] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [subject, setSubject] = useState<(typeof GOLD_SUBJECTS)[number]>("chemistry");
  const [level, setLevel] = useState<(typeof GOLD_LEVELS)[number]>("upper_secondary");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [price, setPrice] = useState("0");
  const [capacity, setCapacity] = useState("12");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");

  if (status !== "approved") {
    return (
      <Panel
        title={status === "pending" ? "Application under review" : "Apply to teach on Gold"}
        description="Gold tutors are independent. This does not register a school and does not change any school affiliation you already have."
      >
        {status === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Platform operators will verify the details you submitted. You will be notified when a
            decision is made.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              apply.mutate(
                {
                  bio,
                  subjects: [subject],
                  levels: [level],
                  languages: ["English"],
                  curriculum: null,
                  qualifications,
                  experienceYears: 1,
                  documentUrls: [],
                  photoUrl: null,
                  delivery: ["live"],
                },
                {
                  onSuccess: () => toast.success("Application submitted for review"),
                  onError: (error) => toast.error(authErrorMessage(error)),
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label>Professional biography</Label>
              <Textarea value={bio} onChange={(event) => setBio(event.target.value)} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={subject}
                  onValueChange={(value) => setSubject(value as typeof subject)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOLD_SUBJECTS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {goldSubjectLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={level} onValueChange={(value) => setLevel(value as typeof level)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOLD_LEVELS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {goldSubjectLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qualifications</Label>
              <Textarea
                value={qualifications}
                onChange={(event) => setQualifications(event.target.value)}
                required
              />
            </div>
            <Button className="rounded-full" disabled={apply.isPending}>
              Submit application
            </Button>
          </form>
        )}
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Publish a Gold class"
        description="Learners discover this independently of any school classroom."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!starts || !ends) {
              toast.error("Set a start and end time.");
              return;
            }
            save.mutate(
              {
                title,
                description,
                subject,
                topic: null,
                level,
                curriculum: null,
                objectives,
                language: "English",
                delivery: "live",
                priceCents: Math.round(Number(price) || 0),
                currency: "UGX",
                capacity: Number(capacity) || 12,
                timezone: "Africa/Kampala",
                startsAt: new Date(starts).toISOString(),
                endsAt: new Date(ends).toISOString(),
                cancellationTerms:
                  "Cancellations more than 24 hours before the first lesson can be refunded by the platform operator. Earnings stay pending settlement until payouts are configured.",
                publish: true,
              },
              {
                onSuccess: () => toast.success("Class published on Gold"),
                onError: (error) => toast.error(authErrorMessage(error)),
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Learning objectives</Label>
            <Textarea
              value={objectives}
              onChange={(event) => setObjectives(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Price (UGX, 0 = free)</Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input
                type="number"
                min={1}
                max={80}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Starts</Label>
              <Input
                type="datetime-local"
                value={starts}
                onChange={(event) => setStarts(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ends</Label>
              <Input
                type="datetime-local"
                value={ends}
                onChange={(event) => setEnds(event.target.value)}
              />
            </div>
          </div>
          <Button className="rounded-full" disabled={save.isPending}>
            Publish class
          </Button>
        </form>
      </Panel>
      <Panel title="Your Gold classes">
        {classes.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (classes.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes yet.</p>
        ) : (
          <ul className="space-y-2">
            {(classes.data ?? []).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.status} · {priceLabel(row.price_cents, row.currency)} ·{" "}
                    {row.enrolled_count}/{row.capacity}
                  </p>
                </div>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/gold/class/$classId" params={{ classId: row.id }}>
                    Manage
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {classes.data?.[0] ? (
        <p className="text-xs text-muted-foreground">
          Pending settlement on this account is shown on your tutor profile after paid enrolments
          verify. Flutterwave does not automatically pay tutors out from this flow.
        </p>
      ) : null}
    </div>
  );
}
