import { createFileRoute, Link, redirect, isRedirect } from "@tanstack/react-router";
import { BookOpen, GraduationCap, HeartHandshake, Shield } from "lucide-react";
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
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
        eSchool platform
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        One workspace for school life
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
        Memskool helps a school run classes, live lessons, assignments and assessments in one place.
        Students learn. Teachers teach. Parents see permitted progress. Administrators keep the
        school organised.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild className="rounded-full">
          <Link preload="intent" to="/auth">
            Create an account
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link preload="intent" to="/auth">
            Sign in
          </Link>
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Students and teachers need a School ID from their institution. Parents are linked by a
        school administrator.
      </p>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        <li className="surface-card p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:brand-shadow">
          <GraduationCap className="mb-3 size-5 text-primary" />
          <h2 className="font-display text-base font-semibold">Students</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Join class, save work in a locker, sit assessments, and ask the AI Tutor when you need
            an explanation.
          </p>
        </li>
        <li className="surface-card p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:brand-shadow">
          <BookOpen className="mb-3 size-5 text-primary" />
          <h2 className="font-display text-base font-semibold">Teachers</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Run live sessions, set work, mark where needed, and publish results when the class is
            ready.
          </p>
        </li>
        <li className="surface-card p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:brand-shadow">
          <HeartHandshake className="mb-3 size-5 text-primary" />
          <h2 className="font-display text-base font-semibold">Parents</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            After your school links you to a child, review attendance and released results — not
            unreleased papers.
          </p>
        </li>
        <li className="surface-card p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:brand-shadow">
          <Shield className="mb-3 size-5 text-primary" />
          <h2 className="font-display text-base font-semibold">Schools</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Each school’s records stay in that school. Staff manage classes, families, and
            membership from School Admin.
          </p>
        </li>
      </ul>
    </PublicLayout>
  );
}
