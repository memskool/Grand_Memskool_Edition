import { useEffect, useState } from "react";
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
  const workspace =
    role === "parent"
      ? "Family"
      : role === "teacher"
        ? "Teaching"
        : role === "institution" || role === "admin"
          ? "School"
          : role === "superadmin"
            ? "Platform"
            : "Student";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,36rem)] flex-col rounded-t-3xl bg-background text-foreground shadow-[0_-12px_40px_rgb(11_28_58/0.18)] [animation:memskool-sheet-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <BrandMark size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold">
                  {profile?.full_name || "Memskool"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {workspace} · {user?.email}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center rounded-full bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
              {groupedNav(links).map((group) => (
                <div key={group.id} className="mb-5">
                  <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
                              "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-secondary",
                            )}
                          >
                            <item.icon className="size-5 shrink-0" />
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          {tabs.map((item) => {
            const active = navPathActive(pathname, item.url);
            return (
              <li key={item.url}>
                <Link
                  preload="intent"
                  to={item.url}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      active && "bg-primary/12",
                    )}
                  >
                    <item.icon className="size-[18px]" />
                  </span>
                  <span className="max-w-full truncate">{item.short ?? item.title}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={cn(
                "flex min-h-12 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                open ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  open && "bg-primary/12",
                )}
              >
                <Menu className="size-[18px]" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
