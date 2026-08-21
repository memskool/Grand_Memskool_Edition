import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, ExternalLink, Globe2, MapPin, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession, useProfile, useRole } from "@/hooks/useAuth";
import {
  useSchools,
  useMyApplications,
  useWithdrawApplication,
  SCHOOL_CATEGORIES,
  type School,
} from "@/lib/discovery-data";
import { ApplicationModal } from "@/components/app/ApplicationModal";
import { ApplicationsTracker } from "@/components/app/ApplicationsTracker";
import { PageHeader, Panel, EmptyState } from "@/components/app/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dream-school")({
  head: () => ({
    meta: [
      { title: "Dream School — Discover & Apply | Memskool" },
      {
        name: "description",
        content:
          "Explore nursery, primary, secondary, TVET and university options, then apply online and track your admission status.",
      },
      { property: "og:title", content: "Dream School — Discover & Apply | Memskool" },
      {
        property: "og:description",
        content: "Search schools, compare fees and submit admission applications from Memskool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DreamSchoolPage,
});

function feeLabel(school: School) {
  if (school.fees_min == null && school.fees_max == null) return "Fees on request";
  const fmt = (n: number) => `${school.fees_currency} ${n.toLocaleString()}`;
  if (school.fees_min != null && school.fees_max != null)
    return `${fmt(school.fees_min)} – ${fmt(school.fees_max)}`;
  return fmt((school.fees_min ?? school.fees_max)!);
}

function DreamSchoolPage() {
  const { user } = useSession();
  const profile = useProfile(user);
  const role = useRole(user);
  const schools = useSchools();
  const applications = useMyApplications(user?.id);
  const withdraw = useWithdrawApplication();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [scope, setScope] = useState("all");
  const [target, setTarget] = useState<School | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (schools.data ?? []).filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (scope === "local" && s.is_international) return false;
      if (scope === "international" && !s.is_international) return false;
      if (!q) return true;
      return [s.name, s.city, s.country, s.description].some((v) => v?.toLowerCase().includes(q));
    });
  }, [schools.data, query, category, scope]);

  const appliedIds = new Set((applications.data ?? []).map((a) => a.school_id));
  const canApply = role.data === "student" || role.data === "parent";

  return (
    <>
      <PageHeader
        title="Dream School"
        subtitle="Discover schools, compare them and apply online — all in one place."
      />

      <Tabs defaultValue="discover" className="space-y-6">
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="applications">
            My applications
            {applications.data?.length ? ` (${applications.data.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-5">
          <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by school, city or country"
                className="pl-9"
                aria-label="Search schools"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {SCHOOL_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anywhere</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="international">International</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {schools.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((school) => (
                <article key={school.id} className="surface-card flex flex-col gap-3 overflow-hidden p-0 transition-transform hover:-translate-y-1">
                  <div className="relative flex items-end gap-3 bg-ink p-5 pt-10 text-ink-foreground">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-brand-accent/25 blur-xl"
                    />
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ink-foreground/10">
                      <Building2 className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-base font-bold">{school.name}</h2>
                      <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
                        <MapPin className="size-3" />
                        {[school.city, school.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 px-5">
                    <Badge variant="secondary" className="capitalize">
                      {school.category}
                    </Badge>
                    {school.is_international ? (
                      <Badge variant="outline" className="gap-1">
                        <Globe2 className="size-3" /> International
                      </Badge>
                    ) : null}
                    <Badge variant={school.admissions_open ? "default" : "outline"}>
                      {school.admissions_open ? "Admissions open" : "Closed"}
                    </Badge>
                    {school.badges.map((b) => (
                      <Badge key={b} variant="outline">
                        {b}
                      </Badge>
                    ))}
                  </div>

                  {school.description ? (
                    <p className="line-clamp-3 px-5 text-sm text-muted-foreground">
                      {school.description}
                    </p>
                  ) : null}

                  <div className="mx-5 rounded-2xl border border-brand-accent/25 bg-brand-accent/8 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fees</p>
                    <p className="text-sm font-semibold text-brand-accent">{feeLabel(school)}</p>
                    {school.fees_notes ? (
                      <p className="text-xs text-muted-foreground">{school.fees_notes}</p>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center gap-2 px-5 pb-5">
                    <Button
                      className="flex-1 rounded-full"
                      disabled={!school.admissions_open || appliedIds.has(school.id) || !canApply}
                      onClick={() => setTarget(school)}
                    >
                      {appliedIds.has(school.id) ? "Applied" : "Apply online"}
                    </Button>
                    {school.website ? (
                      <Button variant="outline" size="icon" className="rounded-full" asChild>
                        <a
                          href={school.website}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Visit website"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No schools match your search"
              hint="Try a different category or clear the filters. School admins can add their institution from the Admin panel."
            />
          )}
        </TabsContent>

        <TabsContent value="applications">
          <Panel
            title="Application tracker"
            description="Live status of every application you've submitted"
          >
            <ApplicationsTracker
              applications={applications.data ?? []}
              loading={applications.isLoading}
              action={(app) =>
                app.status === "pending" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Withdraw application"
                    onClick={async () => {
                      await withdraw.mutateAsync(app.id);
                      toast.success("Application withdrawn");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null
              }
            />
          </Panel>
        </TabsContent>
      </Tabs>

      <ApplicationModal
        school={target}
        userId={user?.id}
        defaultName={profile.data?.full_name ?? ""}
        defaultEmail={profile.data?.email ?? ""}
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      />
    </>
  );
}
