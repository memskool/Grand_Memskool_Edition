import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/app/BrandMark";
import { SiteFooter } from "@/components/app/SiteFooter";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border/50 bg-background/75 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link preload="intent" to="/" className="flex items-center gap-2">
          <BrandMark size={36} priority />
          <span className="font-display text-sm font-bold tracking-tight">Memskool</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link
            preload="intent"
            to="/privacy"
            className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            preload="intent"
            to="/terms"
            className="rounded-full px-3 py-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Terms
          </Link>
          <Link
            preload="intent"
            to="/auth"
            className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition-transform duration-150 active:scale-[0.98]"
          >
            Sign in
          </Link>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
