import logoAsset from "@/assets/memskool-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Memskool logo: black circle, white icon.
 * In dark mode it inverts to a white circle with a black icon.
 */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Memskool"
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-full object-contain object-center dark:invert",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

export function BrandLockup({
  size = 40,
  subtitle = "eSchool",
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
