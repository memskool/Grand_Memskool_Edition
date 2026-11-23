import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyArt, WaveLines } from "@/components/app/art";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[1.7rem] font-bold leading-tight tracking-tight text-foreground sm:text-[2.1rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ServiceNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-[var(--shadow-soft)]">
      <p className="font-medium">{title}</p>
      <p className="mt-1 leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

const TONES = {
  primary: { tile: "bg-primary/10 text-primary", bar: "bg-primary" },
  success: { tile: "bg-leaf/15 text-leaf", bar: "bg-leaf" },
  leaf: { tile: "bg-leaf/15 text-leaf", bar: "bg-leaf" },
  warning: { tile: "bg-gold/20 text-[oklch(0.5_0.12_75)]", bar: "bg-gold" },
  sky: { tile: "bg-sky/15 text-sky", bar: "bg-sky" },
  gold: { tile: "bg-gold/20 text-[oklch(0.5_0.12_75)]", bar: "bg-gold" },
} as const;

/**
 * KPI card (design: big number, tinted icon tile, optional ↗ link). `highlight` renders
 * the navy hero variant used for the most important number in a row.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  loading,
  hint,
  to,
  highlight,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  loading?: boolean;
  hint?: string;
  to?: string;
  highlight?: boolean;
}) {
  const t = TONES[tone];
  const body = (
    <div
      className={cn(
        "relative flex h-full flex-col justify-between overflow-hidden rounded-[1.4rem] border p-4 transition-[transform,box-shadow] duration-200 sm:p-5",
        highlight
          ? "brand-gradient border-transparent text-primary-foreground shadow-[var(--shadow-lift)]"
          : "border-border bg-card shadow-[var(--shadow-soft)]",
        to && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
      )}
    >
      {highlight ? <WaveLines className="absolute inset-0 h-full w-full" /> : null}
      <div className="relative flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-sm font-medium",
            highlight ? "text-primary-foreground/85" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {to ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border",
              highlight ? "border-white/30 bg-white text-primary" : "border-border text-foreground",
            )}
          >
            <ArrowUpRight className="size-4" />
          </span>
        ) : (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              highlight ? "bg-white/15 text-primary-foreground" : t.tile,
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <div className="relative mt-3">
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="font-display text-[2rem] font-bold leading-none tracking-tight sm:text-[2.3rem]">
            {value}
          </p>
        )}
        {hint ? (
          <p
            className={cn(
              "mt-2 text-xs",
              highlight ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
  return to ? (
    <Link
      to={to}
      className="block h-full rounded-[1.4rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

export function Panel({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("surface-card p-4 sm:p-6", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-[1.05rem] font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-secondary/40 px-6 py-9 text-center">
      <div className="relative mb-3">
        <EmptyArt className="h-16 w-24 text-foreground" />
        <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * Tap-friendly choice row (replaces dropdowns where people choose often). Scrolls
 * sideways on phones instead of hiding options behind a menu.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            title={o.hint}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
