import { createFileRoute, Link, redirect, isRedirect } from "@tanstack/react-router";
import { Award, BookOpen, Clapperboard, GraduationCap, HeartHandshake, Shield } from "lucide-react";
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

function LandingPage() {
  return (
    <PublicLayout>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        School workspace
      </p>
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-[2.75rem]">
        One place to run school
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
        Classes, live lessons, assignments and assessments stay inside each registered school.
        Independent tutoring and a free educational video feed sit alongside that workspace — they
        are not a substitute for school enrolment.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link preload="intent" to="/auth">
            Create an account
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link preload="intent" to="/auth">
            Sign in
          </Link>
        </Button>
        <Button asChild variant="sky">
          <Link preload="intent" to="/home">
            Watch Home
          </Link>
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Students and teachers can start without a School ID. Teachers apply to a school from the
        workspace, or teach on Gold. Parents are linked to a child by the school.
      </p>

      <ul className="mt-12 grid gap-3 sm:grid-cols-2">
        <RoleCard
          icon={GraduationCap}
          title="Students"
          tone="navy"
          delay="stagger-1"
          body="Join class, keep work in a locker, sit assessments, and ask the AI Tutor when it is connected."
        />
        <RoleCard
          icon={BookOpen}
          title="Teachers"
          tone="leaf"
          delay="stagger-2"
          body="Sign up first, then apply to a school or teach independently on Gold. Live class and marking unlock after the school approves you."
        />
        <RoleCard
          icon={HeartHandshake}
          title="Parents"
          tone="sky"
          delay="stagger-3"
          body="After the school links you to a child, review timetable, attendance and released results."
        />
        <RoleCard
          icon={Shield}
          title="Schools"
          tone="navy"
          delay="stagger-4"
          body="Each school’s records stay in that school. Staff manage classes, families and membership from School Admin."
        />
        <RoleCard
          icon={Award}
          title="Gold"
          tone="gold"
          delay="stagger-5"
          body="Independent tutors can offer approved coaching classes without registering a school. Access is not automatic from a payment page."
        />
        <RoleCard
          icon={Clapperboard}
          title="Home"
          tone="sky"
          delay="stagger-6"
          body="A free feed of short educational videos. Public clips appear only after a platform operator approves them."
        />
      </ul>
    </PublicLayout>
  );
}

function RoleCard({
  icon: Icon,
  title,
  body,
  tone,
  delay,
}: {
  icon: typeof GraduationCap;
  title: string;
  body: string;
  tone: "navy" | "gold" | "sky" | "leaf";
  delay: string;
}) {
  const iconTone = {
    navy: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold",
    sky: "bg-sky/15 text-sky",
    leaf: "bg-leaf/15 text-leaf",
  } as const;

  return (
    <li className={`page-enter surface-card surface-lift p-5 ${delay}`}>
      <span className={`mb-3 flex size-9 items-center justify-center rounded-lg ${iconTone[tone]}`}>
        <Icon className="size-5" />
      </span>
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}
