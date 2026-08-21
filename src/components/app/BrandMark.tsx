import logoAsset from "@/assets/memskool-crest.jpg.asset.json";
import { cn } from "@/lib/utils";

/**
 * Memskool crest logo (navy + gold shield with laurels) rendered exactly as provided.
 * A generous border radius and subtle ring let it sit cleanly in the premium monochrome UI.
 */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Memskool Institute"
      height={size}
      className={cn(
        "block w-auto shrink-0 rounded-2xl object-contain object-center ring-1 ring-black/10 dark:ring-white/10",
        className
      )}
      style={{ height: size, width: "auto" }}
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
