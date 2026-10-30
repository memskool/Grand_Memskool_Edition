import { createFileRoute, Link, redirect, isRedirect } from "@tanstack/react-router";
import {
  ArrowDown,
  Award,
  BookOpen,
  Bot,
  Clapperboard,
  GraduationCap,
  HeartHandshake,
  Shield,
  Video,
} from "lucide-react";
import { getCurrentAuthUser } from "@/features/auth/services/auth.service";
import { PublicLayout } from "@/components/app/PublicLayout";
import { Button } from "@/components/ui/button";

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
      { title: "Memskool — digital school workspace" },
      {
        name: "description",
        content:
          "Memskool is a school workspace for students, teachers, parents and administrators: classes, live lessons, assessments and a private AI tutor.",
      },
    ],
  }),
  component: LandingPage,
});

const STRIP = [
  "Live class",
  "Assessments",
  "AI Tutor",
  "Locker",
  "Timetable",
  "Gold tutoring",
  "Home videos",
  "School Admin",
];

const JOURNEY = [
  {
    n: "01",
    title: "Create an account",
    body: "Pick student, teacher, parent or school. Students and teachers can start without a School ID.",
  },
  {
    n: "02",
    title: "Join your place",
    body: "Teachers apply with a School ID, or teach independently on Gold. Parents are linked by the school.",
  },
  {
    n: "03",
    title: "The school approves",
    body: "School Admin reviews applications, enrols learners in classes and unlocks live lessons and marking.",
  },
  {
    n: "04",
    title: "Work stays in school",
    body: "Classes, tests, attendance and family updates remain inside that registered school.",
  },
];

function LandingPage() {
  return (
    <PublicLayout wide>
      <section className="relative isolate min-h-[70vh] overflow-hidden px-4 pb-16 pt-16 sm:min-h-[78vh] sm:px-6 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img
            src="/landing/hero-classroom.jpg"
            alt=""
            width={1920}
            height={1080}
            decoding="async"
            fetchPriority="high"
            className="h-full w-full object-cover object-[68%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/82 to-background/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-background/55" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Digital school workspace
          </p>
          <h1 className="font-display max-w-4xl text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Run school.
            <br />
            <em className="font-normal not-italic text-primary/80 sm:italic sm:text-gold">
              Learn. Teach.
            </em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Classes, live lessons and assessments stay inside each registered school. Independent
            tutoring on Gold and a free educational video feed sit alongside — they do not replace
            enrolment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link preload="intent" to="/auth">
                Create an account
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link preload="intent" to="/auth">
                Sign in
              </Link>
            </Button>
            <Button asChild size="lg" variant="sky">
              <Link preload="intent" to="/home">
                Watch Home
              </Link>
            </Button>
          </div>
          <a
            href="#how"
            className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowDown className="size-4" />
            See how it works
          </a>
        </div>
      </section>

      <div className="border-y border-border bg-ink text-ink-foreground">
        <div className="overflow-hidden py-3">
          <div className="marquee-track flex w-max gap-10 px-6 text-sm font-medium tracking-wide">
            {[...STRIP, ...STRIP].map((label, i) => (
              <span key={`${label}-${i}`} className="flex items-center gap-10 whitespace-nowrap">
                {label}
                <span aria-hidden className="size-1.5 rounded-full bg-gold" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <section id="how" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            01 / The journey
          </p>
          <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            One workspace.{" "}
            <em className="font-normal italic text-muted-foreground">A clear path.</em>
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            The path is short: account, join, approval, then class work. Swipe the steps on a phone.
          </p>
          <ol className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
            {JOURNEY.map((step) => (
              <li
                key={step.n}
                className="surface-card min-w-[78vw] snap-start p-5 sm:min-w-0 sm:p-6"
              >
                <p className="font-display text-3xl font-semibold text-gold">{step.n}</p>
                <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ink px-4 py-16 text-ink-foreground sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
            02 / Why Memskool
          </p>
          <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            School tools that stay with you.
          </h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Benefit
              icon={Video}
              title="Live class"
              body="Join or host a lesson from the timetable. School live class unlocks after approval."
            />
            <Benefit
              icon={Bot}
              title="AI Tutor"
              body="Students can ask for explanations inside the workspace when the tutor is connected."
            />
            <Benefit
              icon={BookOpen}
              title="Locker & library"
              body="Keep notes and assignments in one locker. Schools publish materials to their library."
            />
            <Benefit
              icon={Award}
              title="Gold"
              body="Independent tutors offer approved classes without a School ID. Discovery is after review."
            />
          </ul>
        </div>
      </section>

      <section id="roles" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            03 / Who it's for
          </p>
          <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Four roles. Two extra rooms.
          </h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            <RoleCard
              icon={GraduationCap}
              title="Students"
              tone="navy"
              body="Join class, keep work in a locker, sit assessments, and ask the AI Tutor."
            />
            <RoleCard
              icon={BookOpen}
              title="Teachers"
              tone="leaf"
              body="Apply to a school with a School ID, or teach independently on Gold. Live class unlocks after approval."
            />
            <RoleCard
              icon={HeartHandshake}
              title="Parents"
              tone="sky"
              body="After the school links you to a child, review timetable, attendance and released results."
            />
            <RoleCard
              icon={Shield}
              title="Schools"
              tone="navy"
              body="One school per institution account. Run people, classes and admissions from School Admin."
            />
            <RoleCard
              icon={Award}
              title="Gold"
              tone="gold"
              body="Approved coaching classes without registering a school. Access is not automatic from a payment page."
            />
            <RoleCard
              icon={Clapperboard}
              title="Home"
              tone="sky"
              body="A free feed of short educational videos. Public clips appear only after an operator approves them."
            />
          </ul>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Start in minutes.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Create an account, then open your dashboard. Schools share a School ID from School
              Admin so teachers and students can join.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link preload="intent" to="/auth">
                Create an account
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link preload="intent" to="/auth">
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function Benefit({ icon: Icon, title, body }: { icon: typeof Video; title: string; body: string }) {
  return (
    <li>
      <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-gold/15 text-gold">
        <Icon className="size-5" />
      </span>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </li>
  );
}

function RoleCard({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof GraduationCap;
  title: string;
  body: string;
  tone: "navy" | "gold" | "sky" | "leaf";
}) {
  const iconTone = {
    navy: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold",
    sky: "bg-sky/15 text-sky",
    leaf: "bg-leaf/15 text-leaf",
  } as const;

  return (
    <li className="surface-card p-5 sm:p-6">
      <span className={`mb-3 flex size-9 items-center justify-center rounded-lg ${iconTone[tone]}`}>
        <Icon className="size-5" />
      </span>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}
