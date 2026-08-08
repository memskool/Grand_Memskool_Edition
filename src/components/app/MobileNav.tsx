import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Archive, AlarmClock, Video, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Locker", url: "/locker", icon: Archive },
  { title: "Missed", url: "/missed-work", icon: AlarmClock },
  { title: "Live", url: "/virtual-classroom", icon: Video },
  { title: "Shop", url: "/marketplace", icon: ShoppingBag },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active = pathname === item.url;
          return (
            <li key={item.url} className="flex-1">
              <Link
                to={item.url}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-all",
                    active && "brand-gradient brand-shadow",
                  )}
                >
                  <item.icon className="size-[18px]" />
                </span>

                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
