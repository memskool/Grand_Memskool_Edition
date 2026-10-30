import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/app/BrandMark";
import { ThemeToggle } from "@/components/app/ThemeToggle";

export const publicNavLinkClass =
  "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 py-2 text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3";

export const publicNavCtaClass =
  "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground shadow-sm transition-transform duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4";

export function PublicHeader({
  brand,
  children,
  action,
}: {
  brand?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="relative sticky top-0 z-20 flex flex-nowrap items-center gap-2 border-b border-border bg-background/88 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-6">
      <Link
        preload="intent"
        to="/"
        className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandMark size={32} priority />
        <span className="font-display hidden max-w-[11rem] truncate text-sm font-semibold tracking-tight text-foreground sm:inline">
          {brand ?? "Memskool"}
        </span>
      </Link>
      <nav
        aria-label="Site"
        className="ml-auto flex min-w-0 flex-nowrap items-center justify-end gap-0.5 overflow-x-auto text-sm sm:gap-1"
      >
        {children}
        {action}
        <ThemeToggle />
      </nav>
      <span
        aria-hidden
        className="accent-rail pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
      />
    </header>
  );
}
