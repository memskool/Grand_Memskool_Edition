import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useSession, useProfile } from "@/hooks/useAuth";
import { useAccess } from "@/lib/access";
import { quickActionsFor, TILE_CLASS } from "@/lib/launcher";
import { SchoolScene, WaveLines } from "@/components/app/art";
import { cn } from "@/lib/utils";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Navy welcome banner with the school scene (UI uplift). */
export function WelcomeBanner({ subtitle }: { subtitle?: string }) {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const { role, schoolName, pendingApproval } = useAccess();
  const first = (profile?.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const main = quickActionsFor(role, pendingApproval)[0];
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="brand-gradient relative overflow-hidden rounded-[1.75rem] p-6 shadow-[var(--shadow-lift)] sm:p-8">
      <WaveLines className="absolute inset-0 h-full w-full" />
      <div className="relative grid items-center gap-4 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground/70">
            {today}
            {schoolName ? ` · ${schoolName}` : ""}
          </p>
          <h1 className="mt-2 font-display text-[1.7rem] font-bold leading-tight text-primary-foreground sm:text-[2.2rem]">
            {greeting()}, {first}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-lg text-sm text-primary-foreground/80 sm:text-[0.95rem]">
              {subtitle}
            </p>
          ) : null}
          {main ? (
            <Link
              to={main.to as never}
              {...(main.search ? { search: main.search as never } : {})}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-[oklch(0.225_0.054_262)] shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <main.icon className="size-4" /> {main.label}
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </div>
        <SchoolScene className="hidden h-40 w-60 md:block lg:h-44 lg:w-64" />
      </div>
    </section>
  );
}

/** One-tap tiles for the jobs people do most (no menus to dig through). */
export function QuickActions() {
  const { role, pendingApproval } = useAccess();
  const actions = quickActionsFor(role, pendingApproval);
  if (!actions.length) return null;
  return (
    <section aria-label="Quick actions">
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          actions.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-4",
        )}
      >
        {actions.map((a) => (
          <Link
            key={`${a.label}-${a.to}`}
            to={a.to as never}
            {...(a.search ? { search: a.search as never } : {})}
            preload="intent"
            className="group flex flex-col gap-3 rounded-[1.4rem] border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105",
                TILE_CLASS[a.tone],
              )}
            >
              <a.icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">{a.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{a.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
