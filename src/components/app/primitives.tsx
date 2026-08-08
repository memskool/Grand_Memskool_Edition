import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <span
          className="mb-2 inline-block h-1 w-10 rounded-full"
          style={{ background: "var(--gradient-brand)" }}
        />
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning";
  loading?: boolean;
}) {
  const tones = {
    primary: "bg-primary/12 text-primary",
    success: "bg-success/14 text-success",
    warning: "bg-warning/18 text-warning-foreground",
  } as const;

  return (
    <div className="surface-card flex items-center gap-4 p-5 transition-shadow hover:brand-shadow">
      <span
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", tones[tone])}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-12" />
        ) : (
          <p className="font-display text-2xl font-semibold leading-tight">{value}</p>
        )}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card p-5 sm:p-6", className)}>
      <header className="mb-4">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <Icon className="mb-3 size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
