import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, MapPin } from "lucide-react";
import type { ClassRow } from "@/lib/school-data";
import { EmptyState } from "@/components/app/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ClassCard({
  klass,
  meta,
  className,
}: {
  klass: ClassRow;
  meta?: string;
  className?: string;
}) {
  return (
    <Link
      to="/virtual-classroom"
      className={cn(
        "group relative flex min-h-[152px] flex-col justify-between overflow-hidden rounded-3xl bg-ink p-5 text-ink-foreground transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_var(--brand-accent)]",
        className,
      )}
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-brand-accent/20 blur-xl transition-opacity duration-300 group-hover:bg-brand-accent/35"
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-ink-foreground/10 transition-colors group-hover:bg-brand-accent group-hover:text-brand-accent-foreground">
          <BookOpen className="size-[18px]" />
        </span>
        <ArrowUpRight className="size-4 opacity-40 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="relative min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
          {klass.subject?.name ?? "General"}
        </p>
        <p className="mt-1 truncate font-display text-xl font-bold leading-tight">{klass.name}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
          {klass.room ? (
            <>
              <MapPin className="size-3.5" />
              {klass.room}
            </>
          ) : null}
          {meta ? <span className="truncate">{meta}</span> : null}
        </p>
      </div>
    </Link>
  );
}

export function ClassCardGrid({
  classes,
  loading,
  emptyHint,
}: {
  classes: ClassRow[];
  loading?: boolean;
  emptyHint?: string;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[148px] rounded-3xl" />
        ))}
      </div>
    );
  }

  if (!classes.length) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No classes yet"
        {...(emptyHint ? { hint: emptyHint } : {})}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {classes.slice(0, 6).map((c) => (
        <ClassCard key={c.id} klass={c} />
      ))}
    </div>
  );
}
