import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, redirect, isRedirect } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Lock,
  MapPin,
  Play,
  Search,
  Shield,
  Smartphone,
  Video,
  Wifi,
} from "lucide-react";
import { getCurrentAuthUser } from "@/features/auth/services/auth.service";
import { lookupSchoolByCode, type SchoolLookupResult } from "@/lib/school-lookup.functions";
import { PublicLayout } from "@/components/app/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LeafCluster, SchoolScene, WaveLines } from "@/components/app/art";
import { CoverArt, type CoverKind } from "@/components/app/covers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const user = await getCurrentAuthUser();
      if (user) throw redirect({ to: "/dashboard" });
    } catch (error) {
      if (isRedirect(error)) throw error;
    }
  },
  head: () => ({
    meta: [
      { title: "Memskool — your whole school, in one bright place" },
      {
        name: "description",
        content:
          "Memskool is a school workspace for students, teachers, parents and schools: live lessons, assignments, tests, report cards and family updates — on any phone or laptop.",
      },
    ],
  }),
  component: LandingPage,
});

/* ------------------------------------------------------------------ */
/* Scroll reveal                                                       */
/* ------------------------------------------------------------------ */

/** Adds `is-in` to every `.reveal` inside the page once it scrolls into view. */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    // Safety net: never leave content hidden if the observer misbehaves on a device.
    const fallback = window.setTimeout(() => {
      els.forEach((el) => el.classList.add("is-in"));
    }, 3000);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
}

function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.18em]",
        light ? "text-gold" : "text-sky",
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LandingPage() {
  useReveal();
  return (
    <PublicLayout wide>
      <Hero />
      <FeatureStrip />
      <SchoolFinder />
      <Roles />
      <HowItWorks />
      <Features />
      <HomeTeaser />
      <Faq />
      <FinalCta />
    </PublicLayout>
  );
}

/* ---------------------------- Hero -------------------------------- */

function Hero() {
  return (
    <section className="brand-gradient relative isolate overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
      <WaveLines className="wave-drift absolute -inset-x-10 inset-y-0 -z-10 h-full w-[115%] opacity-90" />
      <LeafCluster className="absolute -bottom-6 -left-10 -z-10 hidden h-44 w-60 opacity-40 sm:block" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="page-enter">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-primary-foreground ring-1 ring-white/15">
            <span className="size-1.5 rounded-full bg-gold" /> A digital home for every school
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight text-primary-foreground sm:text-6xl lg:text-[4.2rem]">
            Your whole school,
            <br />
            <span className="text-shine">in one bright place.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/80 sm:text-lg">
            Live lessons, assignments, tests, report cards and family updates — for students,
            teachers, parents and schools. Built to work on any phone, even on a weak connection.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="gold">
              <Link preload="intent" to="/auth">
                Create a free account <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20"
            >
              <Link preload="intent" to="/auth">
                Sign in
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-white/10"
            >
              <Link preload="intent" to="/home">
                <Play className="size-4" /> Watch Home
              </Link>
            </Button>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-primary-foreground/80">
            {[
              { icon: Smartphone, label: "Any phone or laptop" },
              { icon: Wifi, label: "Light on data" },
              { icon: Lock, label: "Private to each school" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-gold" /> {label}
              </li>
            ))}
          </ul>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** Decorative, animated glimpse of the app (sample content, not real records). */
function HeroPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="float-slow relative rounded-[1.75rem] bg-white p-4 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.45)] ring-1 ring-black/5 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[oklch(0.5_0.03_262)]">
              Monday · S2 East
            </p>
            <p className="font-display text-lg font-bold text-[oklch(0.22_0.05_262)]">
              Good morning, Amina
            </p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-full bg-gold/25 text-sm font-bold text-[oklch(0.22_0.05_262)]">
            A
          </span>
        </div>
        {/* live class card */}
        <div className="mt-4 overflow-hidden rounded-2xl">
          <CoverArt kind="video" seed="hero-live" className="h-28">
            <div className="flex h-full flex-col justify-between p-3 text-white">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold">
                <span className="live-pulse size-2 rounded-full bg-red-500" /> LIVE now
              </span>
              <span>
                <span className="block text-sm font-bold">Biology · Cell structure</span>
                <span className="block text-[11px] text-white/80">Mr Okello · 24 in the room</span>
              </span>
            </div>
          </CoverArt>
        </div>
        {/* report card bars */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Maths", pct: 82, tone: "bg-primary" },
            { label: "English", pct: 74, tone: "bg-leaf" },
            { label: "Science", pct: 91, tone: "bg-gold" },
          ].map((s, i) => (
            <div key={s.label} className="rounded-xl bg-[oklch(0.965_0.007_262)] p-2.5">
              <p className="text-[11px] text-[oklch(0.5_0.03_262)]">{s.label}</p>
              <p className="font-display text-base font-bold text-[oklch(0.22_0.05_262)]">
                {s.pct}%
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[oklch(0.9_0.01_262)]">
                <div
                  className={cn("bar-fill h-full rounded-full", s.tone)}
                  style={{ width: `${s.pct}%`, animationDelay: `${0.4 + i * 0.25}s` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* floating notification */}
      <div className="toast-cycle absolute -bottom-6 -left-2 flex max-w-[16rem] items-start gap-2.5 rounded-2xl bg-white p-3 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)] ring-1 ring-black/5 sm:-left-8">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-leaf text-white">
          <Bell className="size-4" />
        </span>
        <span>
          <span className="block text-xs font-semibold text-[oklch(0.22_0.05_262)]">
            Your work was marked
          </span>
          <span className="block text-[11px] text-[oklch(0.5_0.03_262)]">
            Essay · 18 / 20 (90%)
          </span>
        </span>
      </div>
      {/* floating badge */}
      <div className="float-slower absolute -right-2 -top-5 hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[oklch(0.22_0.05_262)] shadow-lg ring-1 ring-black/5 sm:flex">
        <CheckCircle2 className="size-4 text-leaf" /> Attendance saved
      </div>
    </div>
  );
}

/* ------------------------- Feature strip --------------------------- */

const STRIP = [
  "Live class",
  "Assignments & marking",
  "Timed tests",
  "Report cards",
  "Parent alerts",
  "Library",
  "Gold tutoring",
  "Home videos",
  "School Admin",
];

function FeatureStrip() {
  return (
    <div className="border-b border-border bg-card">
      <div className="overflow-hidden py-4">
        <div className="marquee-track flex w-max gap-10 px-6 text-sm font-semibold tracking-wide text-foreground/80">
          {[...STRIP, ...STRIP].map((label, i) => (
            <span key={`${label}-${i}`} className="flex items-center gap-10 whitespace-nowrap">
              {label}
              <span aria-hidden className="size-1.5 rounded-full bg-gold" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- School finder --------------------------- */

function SchoolFinder() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "found"; school: NonNullable<SchoolLookupResult> }
    | { kind: "missing" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (value.length < 2) return;
    setState({ kind: "loading" });
    try {
      const school = await lookupSchoolByCode({ data: { code: value } });
      setState(school ? { kind: "found", school } : { kind: "missing" });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not check right now.",
      });
    }
  };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="reveal mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-10 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <Eyebrow>Find your school</Eyebrow>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Already have a School ID?
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            Type the code your school gave you to check it is on Memskool, then create your account
            to join.
          </p>
          <form onSubmit={find} className="mt-6 flex max-w-lg flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (state.kind !== "idle" && state.kind !== "loading") setState({ kind: "idle" });
                }}
                placeholder="e.g. KMHS-2026"
                aria-label="School ID"
                className="h-12 rounded-full pl-11"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={state.kind === "loading" || code.trim().length < 2}
            >
              {state.kind === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
              Check
            </Button>
          </form>
          <div className="mt-4 min-h-[4.5rem]" aria-live="polite">
            {state.kind === "found" ? (
              <div className="page-enter flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-2xl border border-leaf/30 bg-leaf/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-leaf text-white">
                    <Building2 className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{state.school.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {[state.school.city, state.school.country].filter(Boolean).join(", ") ||
                        "On Memskool"}
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="leaf">
                  <Link to="/auth" search={{ redirect: "/dream-school" }}>
                    Join this school <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ) : state.kind === "missing" ? (
              <p className="page-enter max-w-lg rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                No school uses that ID yet. Check the code with your school — or create an account
                and explore schools in Dream School.
              </p>
            ) : state.kind === "error" ? (
              <p className="page-enter max-w-lg rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="relative hidden h-full min-h-56 lg:block">
          <CoverArt
            kind="school"
            seed="finder"
            art="center"
            className="absolute inset-0 rounded-3xl"
          />
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Roles ------------------------------- */

const ROLES: Array<{
  id: string;
  label: string;
  icon: typeof GraduationCap;
  kind: CoverKind;
  title: string;
  points: string[];
}> = [
  {
    id: "students",
    label: "Students",
    icon: GraduationCap,
    kind: "book",
    title: "Learn from anywhere, keep everything in one place.",
    points: [
      "Join live lessons from your phone — the class waits if your teacher's network drops",
      "Hand in assignments and see your marks and feedback the moment they're ready",
      "Your report card, timetable and library, always one tap away",
    ],
  },
  {
    id: "teachers",
    label: "Teachers",
    icon: BookOpen,
    kind: "tutor",
    title: "Teach, mark and track — without the paperwork.",
    points: [
      "Start a live class in one tap; attendance is recorded for you",
      "Mark work with feedback, return it for changes, and keep a gradebook",
      "Build timed tests that mark themselves, or teach independently on Gold",
    ],
  },
  {
    id: "parents",
    label: "Parents",
    icon: HeartHandshake,
    kind: "notes",
    title: "Know how your child is doing, as it happens.",
    points: [
      "Same-day alert if your child is marked absent",
      "Term report cards with teacher and head-teacher comments",
      "Timetable, released results and messages with the school",
    ],
  },
  {
    id: "schools",
    label: "Schools",
    icon: Shield,
    kind: "school",
    title: "Run admissions, classes and results from one dashboard.",
    points: [
      "Import a whole school at once — even students without email",
      "Approve applications, set up classes, timetables and notices",
      "See attendance trends, learners who need attention, and teaching activity",
    ],
  },
];

function Roles() {
  const [active, setActive] = useState(ROLES[0]!.id);
  const role = ROLES.find((r) => r.id === active) ?? ROLES[0]!;
  return (
    <section id="roles" className="scroll-mt-20 px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="reveal">
          <Eyebrow>Who it's for</Eyebrow>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            One platform. The right tools for everyone.
          </h2>
        </div>
        <div
          role="tablist"
          aria-label="Choose a role"
          className="reveal mt-7 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
        >
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={r.id === active}
              onClick={() => setActive(r.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors active:scale-[0.97]",
                r.id === active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <r.icon className="size-4" /> {r.label}
            </button>
          ))}
        </div>
        <div
          key={role.id}
          className="page-enter mt-6 grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-soft)] md:grid-cols-[0.85fr_1fr]"
        >
          <CoverArt kind={role.kind} seed={role.id} art="center" className="min-h-56" />
          <div className="p-6 sm:p-9">
            <h3 className="font-display text-2xl font-bold leading-tight">{role.title}</h3>
            <ul className="mt-5 space-y-3">
              {role.points.map((p) => (
                <li key={p} className="flex gap-3 text-sm leading-relaxed sm:text-base">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-leaf" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-7">
              <Link preload="intent" to="/auth">
                Start as {role.label.toLowerCase().replace(/s$/, "")}{" "}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------- How it works --------------------------- */

const STEPS = [
  {
    title: "Create an account",
    body: "Choose student, teacher, parent or school. It takes a minute.",
  },
  {
    title: "Join your school",
    body: "Use your School ID or apply from Dream School. Teachers can also teach on Gold.",
  },
  { title: "Get approved", body: "Your school approves you and puts you in your classes." },
  { title: "Start learning", body: "Live lessons, work, tests and results — all in one place." },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-card px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="reveal text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mx-auto mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            From sign-up to your first lesson in four steps.
          </h2>
        </div>
        <ol className="relative mt-12 grid gap-8 md:grid-cols-4 md:gap-6">
          <span
            aria-hidden
            className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-0.5 bg-[linear-gradient(90deg,var(--color-gold),var(--color-sky),var(--color-leaf))] md:block"
          />
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="reveal relative text-center"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span className="relative mx-auto flex size-14 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground shadow-[var(--shadow-lift)] ring-8 ring-card">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mx-auto mt-1.5 max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------- Features ----------------------------- */

const FEATURES: Array<{ kind: CoverKind; title: string; body: string; icon: typeof Video }> = [
  {
    kind: "video",
    icon: Video,
    title: "Live class",
    body: "Video lessons with chat, raised hands and an audio-only mode for weak connections.",
  },
  {
    kind: "course",
    icon: ClipboardCheck,
    title: "Assignments & tests",
    body: "Hand in work, get marked with feedback, and sit timed tests that mark themselves.",
  },
  {
    kind: "research",
    icon: GraduationCap,
    title: "Gradebook & report cards",
    body: "Every mark in one place, printable term report cards with comments.",
  },
  {
    kind: "book",
    icon: BookOpen,
    title: "Library & locker",
    body: "School materials on a shelf, and a private locker for your own notes and files.",
  },
  {
    kind: "notes",
    icon: Bell,
    title: "Alerts for families",
    body: "Parents hear about absences, marks and results — in the app, by email and on their phone.",
  },
  {
    kind: "tutor",
    icon: CheckCircle2,
    title: "Gold tutoring",
    body: "Independent, approved tutors offer extra classes beyond the school timetable.",
  },
];

function Features() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="reveal">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The tools a school actually uses, every day.
          </h2>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="reveal group overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
              style={{ animationDelay: `${(i % 3) * 100}ms` }}
            >
              <CoverArt kind={f.kind} seed={f.title} className="h-36" />
              <div className="p-5">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <f.icon className="size-4 text-sky" /> {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------- Home teaser --------------------------- */

function HomeTeaser() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="reveal brand-gradient relative mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[2rem] p-7 sm:p-12 lg:grid-cols-2">
        <WaveLines className="wave-drift absolute inset-0 h-full w-full" />
        <div className="relative">
          <Eyebrow light>Free for everyone</Eyebrow>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Short learning videos on Home.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
            Bite-sized lessons made by teachers and schools, reviewed before they go live. No
            account needed to watch.
          </p>
          <Button asChild size="lg" variant="gold" className="mt-6">
            <Link preload="intent" to="/home">
              <Play className="size-4" /> Watch now
            </Link>
          </Button>
        </div>
        <div
          aria-hidden
          className="relative mx-auto flex h-64 w-full max-w-sm items-center justify-center"
        >
          {[
            { kind: "research" as const, cls: "-rotate-6 -translate-x-16 scale-90 opacity-80" },
            { kind: "book" as const, cls: "rotate-6 translate-x-16 scale-90 opacity-80" },
            { kind: "video" as const, cls: "float-slow z-10" },
          ].map((c) => (
            <div
              key={c.kind}
              className={cn(
                "absolute h-60 w-36 overflow-hidden rounded-3xl shadow-2xl ring-4 ring-white/15",
                c.cls,
              )}
            >
              <CoverArt kind={c.kind} seed={`home-${c.kind}`} art="top" className="h-full">
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10 text-[11px] font-semibold text-white">
                  <Play className="size-3.5" /> 1:24
                </span>
              </CoverArt>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ FAQ -------------------------------- */

const FAQ = [
  {
    q: "Does it work on a phone?",
    a: "Yes. Memskool is built phone-first and works in any modern browser on Android, iPhone and laptops. Live classes have a Low data and Audio only mode for weak connections.",
  },
  {
    q: "Do I need a School ID to sign up?",
    a: "No. Students and teachers can create an account first. Use a School ID or Dream School to join a school later; teachers can also teach independently on Gold.",
  },
  {
    q: "Is creating an account free?",
    a: "Yes, creating an account is free, and Home videos are free to watch. Some Gold tutoring classes may have a fee set by the tutor.",
  },
  {
    q: "Who can see my school's information?",
    a: "Only your school. Classes, marks, attendance and messages stay inside the school that owns them, and parents only see children the school has linked to them.",
  },
  {
    q: "How do parents get access?",
    a: "Parents create an account and the school links them to their child. After that they see the timetable, attendance alerts, released results and report cards.",
  },
];

function Faq() {
  return (
    <section className="bg-card px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="reveal">
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Good to know.
          </h2>
          <SchoolScene className="mt-8 hidden h-44 w-64 lg:block" />
        </div>
        <Accordion type="single" collapsible className="reveal">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* --------------------------- Final CTA ----------------------------- */

function FinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gold px-7 py-12 sm:px-12">
        <LeafCluster className="absolute -bottom-6 -right-6 h-48 w-64 opacity-70" />
        <div className="relative max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-[oklch(0.22_0.05_262)] sm:text-4xl">
            Bring your school online today.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[oklch(0.3_0.05_262)] sm:text-base">
            Create an account in a minute. Schools get a School ID to share with teachers and
            students.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link preload="intent" to="/auth">
                Create a free account <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-[oklch(0.22_0.05_262)]/20 bg-white/60"
            >
              <Link preload="intent" to="/auth">
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
