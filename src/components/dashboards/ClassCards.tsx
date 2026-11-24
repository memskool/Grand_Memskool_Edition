import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, MapPin, Video } from "lucide-react";
import { LeafCluster, WaveLines } from "@/components/app/art";
import type { ClassRow } from "@/lib/school-data";
import { EmptyState } from "@/components/app/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Stable colour per class so each one is recognisable at a glance. */
const THUMBS = [
  "bg-[linear-gradient(135deg,oklch(0.3_0.07_262),oklch(0.45_0.1_255))]",
  "bg-[linear-gradient(135deg,oklch(0.45_0.1_160),oklch(0.6_0.12_150))]",
  "bg-[linear-gradient(135deg,oklch(0.55_0.12_75),oklch(0.72_0.13_88))]",
  "bg-[linear-gradient(135deg,oklch(0.45_0.11_230),oklch(0.62_0.1_220))]",
  "bg-[linear-gradient(135deg,oklch(0.45_0.14_290),oklch(0.6_0.13_300))]",
  "bg-[linear-gradient(135deg,oklch(0.5_0.16_20),oklch(0.65_0.15_35))]",
];

function thumbFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return THUMBS[h % THUMBS.length]!;
}

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
      preload="intent"
      to="/virtual-classroom"
      search={{ class: klass.id }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[1.4rem] border border-border bg-card shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className={cn("relative h-24 overflow-hidden", thumbFor(klass.id))}>
        <WaveLines className="absolute inset-0 h-full w-full" />
        <LeafCluster className="absolute -bottom-6 -right-4 h-24 w-32 opacity-60" />
        <span className="absolute left-4 top-4 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
          {klass.subject?.name ?? "General"}
        </span>
        <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white text-[oklch(0.225_0.054_262)] opacity-90 transition-opacity group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="min-w-0 p-4">
        <p className="truncate font-display text-lg font-bold leading-tight">{klass.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {klass.room ? (
            <>
              <MapPin className="size-3.5" />
              {klass.room}
            </>
          ) : (
            <>
              <Video className="size-3.5" /> Tap to open the live room
            </>
          )}
          {meta ? <span className="truncate">· {meta}</span> : null}
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
          <Skeleton key={i} className="h-[168px] rounded-[1.4rem]" />
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
