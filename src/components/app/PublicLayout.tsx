import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/app/BrandMark";
import { SiteFooter } from "@/components/app/SiteFooter";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="canvas-mesh relative flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="relative sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/88 px-4 py-3 backdrop-blur-md sm:px-6">
        <Link preload="intent" to="/" className="flex items-center gap-2">
          <BrandMark size={32} priority />
          <span className="font-display text-sm font-semibold tracking-tight">Memskool</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link
            preload="intent"
            to="/home"
            className="rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-sky/10 hover:text-sky"
          >
            Home
          </Link>
          <Link
            preload="intent"
            to="/privacy"
            className="rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            preload="intent"
            to="/terms"
            className="rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
          >
            Terms
          </Link>
          <Link
            preload="intent"
            to="/auth"
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-transform duration-150 hover:-translate-y-px"
          >
            Sign in
          </Link>
        </nav>
        <span
          aria-hidden
          className="accent-rail pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
        />
      </header>
      <main id="main" className="page-enter mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
