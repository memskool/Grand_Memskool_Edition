import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/app/SiteFooter";
import { PublicHeader, publicNavCtaClass, publicNavLinkClass } from "@/components/app/PublicHeader";

export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="canvas-mesh relative flex min-h-screen flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <PublicHeader
        action={
          <Link preload="intent" to="/auth" className={publicNavCtaClass}>
            Sign in
          </Link>
        }
      >
        {wide ? (
          <>
            <a href="#how" className={`${publicNavLinkClass} hidden sm:inline-flex`}>
              How it works
            </a>
            <a href="#roles" className={`${publicNavLinkClass} hidden md:inline-flex`}>
              Who it's for
            </a>
          </>
        ) : null}
        <Link preload="intent" to="/home" className={`${publicNavLinkClass} hover:text-sky`}>
          Watch
        </Link>
        <Link
          preload="intent"
          to="/privacy"
          className={`${publicNavLinkClass} hidden sm:inline-flex`}
        >
          Privacy
        </Link>
        <Link
          preload="intent"
          to="/terms"
          className={`${publicNavLinkClass} hidden sm:inline-flex`}
        >
          Terms
        </Link>
      </PublicHeader>
      <main
        id="main"
        className={
          wide
            ? "page-enter w-full min-w-0 flex-1"
            : "page-enter mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6"
        }
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
