import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExamMode } from "@/lib/exam-mode";
import { useSession, useProfile } from "@/hooks/useAuth";
import { useAccess } from "@/lib/access";
import { groupedNav, navForRole, mobileTabsForRole, navPathActive } from "@/lib/nav";
import { BrandMark } from "@/components/app/BrandMark";

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const examActive = useExamMode();
  const { user } = useSession();
  const { role, pendingApproval } = useAccess();
  const { data: profile } = useProfile(user);

  const links = navForRole(role, examActive, pendingApproval);
  const tabs = mobileTabsForRole(role, examActive, pendingApproval);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-xl"
          />
          <div className="absolute inset-x-3 bottom-24 top-6 flex flex-col overflow-hidden rounded-xl bg-ink text-ink-foreground shadow-2xl [animation:memskool-sheet-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]">
            <div className="flex items-center gap-3 border-b border-ink-foreground/10 px-5 py-4">
              <BrandMark size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-bold">
                  {profile?.full_name || "Memskool"}
                </p>
                <p className="truncate text-xs capitalize text-ink-muted">
                  {role ?? "student"} · {user?.email}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg bg-ink-foreground/10"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              {groupedNav(links).map((group) => (
                <div key={group.id} className="mb-4">
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    {group.label}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const active = navPathActive(pathname, item.url);
                      return (
                        <li key={item.url}>
                          <Link
                            preload="intent"
                            to={item.url}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-150",
                              active
                                ? "bg-ink-foreground/12 text-ink-foreground"
                                : "text-ink-foreground/85 hover:bg-ink-foreground/10",
                            )}
                          >
                            <item.icon className="size-[18px]" />
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((item) => {
            const active = navPathActive(pathname, item.url);
            return (
              <li key={item.url} className="flex-1">
                <Link
                  preload="intent"
                  to={item.url}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150",
                    active
                      ? item.accent === "gold"
                        ? "text-gold"
                        : item.accent === "sky"
                          ? "text-sky"
                          : item.accent === "leaf"
                            ? "text-leaf"
                            : "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-12 items-center justify-center rounded-lg transition-transform duration-150",
                      active && "scale-105 bg-primary text-primary-foreground",
                      active && item.accent === "gold" && "bg-gold text-gold-foreground",
                      active && item.accent === "sky" && "bg-sky text-sky-foreground",
                      active && item.accent === "leaf" && "bg-leaf text-leaf-foreground",
                    )}
                  >
                    <item.icon className="size-[18px]" />
                  </span>
                  {item.short ?? item.title}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={cn(
                "flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                open ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-lg transition-all",
                  open && "bg-primary text-primary-foreground",
                )}
              >
                <Menu className="size-[18px]" />
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
