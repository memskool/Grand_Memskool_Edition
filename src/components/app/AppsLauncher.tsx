import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/access";
import { useExamMode } from "@/lib/exam-mode";
import { navForRole } from "@/lib/nav";
import { APP_META, TILE_CLASS } from "@/lib/launcher";
import { cn } from "@/lib/utils";

/** Google-style apps grid: every feature for your role, one tap away. */
export function AppsLauncher() {
  const [open, setOpen] = useState(false);
  const { role, pendingApproval } = useAccess();
  const examActive = useExamMode();
  const items = navForRole(role, examActive, pendingApproval);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="All Memskool apps">
          <LayoutGrid className="size-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] rounded-3xl p-3">
        <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Memskool apps
        </p>
        <div className="grid grid-cols-3 gap-1">
          {items.map((item) => {
            const meta = APP_META[item.url];
            return (
              <Link
                key={item.url}
                to={item.url}
                preload="intent"
                onClick={() => setOpen(false)}
                className="flex flex-col items-center gap-2 rounded-2xl px-1 py-3 text-center transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-2xl shadow-sm",
                    TILE_CLASS[meta?.tone ?? "navy"],
                  )}
                >
                  <item.icon className="size-5" />
                </span>
                <span className="line-clamp-2 text-xs font-medium leading-tight">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
