import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/app/BrandMark";
import { SiteFooter } from "@/components/app/SiteFooter";
import { useSession } from "@/hooks/useAuth";

export function HomePublicShell({
  children,
  fullBleed = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const { user } = useSession();
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/92 px-4 py-3 backdrop-blur-md sm:px-6">
        <Link preload="intent" to="/" className="flex items-center gap-2">
          <BrandMark size={32} priority />
          <span className="font-display text-sm font-semibold tracking-tight">Memskool Home</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link
            preload="intent"
            to="/home"
            className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            Watch
          </Link>
          {user ? (
            <>
              <Link
                preload="intent"
                to="/home-studio"
                className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                Publish
              </Link>
              <Link
                preload="intent"
                to="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
              >
                Workspace
              </Link>
            </>
          ) : (
            <Link
              preload="intent"
              to="/auth"
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <main
        id="main"
        className={fullBleed ? "flex-1" : "mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6"}
      >
        {children}
      </main>
      {fullBleed ? null : <SiteFooter />}
    </div>
  );
}
