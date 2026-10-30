import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/app/SiteFooter";
import { PublicHeader, publicNavCtaClass, publicNavLinkClass } from "@/components/app/PublicHeader";
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
    <div className="canvas-mesh relative flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <PublicHeader
        brand={
          <>
            Memskool <span className="text-sky">Home</span>
          </>
        }
        action={
          user ? (
            <Link
              preload="intent"
              to="/dashboard"
              className={`${publicNavCtaClass} bg-sky text-sky-foreground`}
            >
              Workspace
            </Link>
          ) : (
            <Link
              preload="intent"
              to="/auth"
              className={`${publicNavCtaClass} bg-sky text-sky-foreground`}
            >
              Sign in
            </Link>
          )
        }
      >
        <Link preload="intent" to="/home" className={publicNavLinkClass}>
          Watch
        </Link>
        {user ? (
          <Link preload="intent" to="/home-studio" className={publicNavLinkClass}>
            Publish
          </Link>
        ) : null}
      </PublicHeader>
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
