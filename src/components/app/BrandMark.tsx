import logo from "@/assets/memskool-logo.png";
import { cn } from "@/lib/utils";

/** Memskool Institute crest. Full colour — do not invert. */
export function BrandMark({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={logo}
      alt="Memskool Institute"
      width={size}
      height={size}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      loading={priority ? "eager" : "lazy"}
      className={cn("shrink-0 rounded-md object-contain object-center", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function BrandLockup({
  size = 40,
  subtitle = "Institute",
  className,
}: {
  size?: number;
  subtitle?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-lg font-bold leading-tight tracking-tight">
          Memskool
        </span>
        {subtitle ? (
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
