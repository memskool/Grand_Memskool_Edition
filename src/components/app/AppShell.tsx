import type { ReactNode } from "react";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { UserMenu } from "@/components/app/UserMenu";
import { NotificationBell } from "@/components/app/NotificationBell";
import { MobileNav } from "@/components/app/MobileNav";
import { SiteFooter } from "@/components/app/SiteFooter";
import { BrandMark } from "@/components/app/BrandMark";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { RouteGuard } from "@/components/app/RouteGuard";
import { IdentityGate } from "@/components/app/IdentityGate";
import { IdentityBanners } from "@/components/app/IdentityBanners";
import { AppErrorBoundary } from "@/components/app/AppErrorBoundary";
import { NetworkBanner } from "@/components/app/NetworkBanner";
import { registerFcmToken } from "@/lib/firebase/fcm";
import { PRODUCT_EVENTS, trackProductEvent } from "@/lib/analytics";

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    void registerFcmToken().catch(() => undefined);
    void trackProductEvent(PRODUCT_EVENTS.workspaceOpen);
  }, []);
  return (
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset className="canvas-mesh min-w-0 overflow-x-clip">
        <NetworkBanner />
        <header className="relative sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border/80 bg-background/88 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:h-14 sm:gap-3 sm:px-6">
          <SidebarTrigger className="hidden rounded-lg md:inline-flex" />
          <BrandMark size={32} priority />
          <span className="hidden font-display text-sm font-semibold tracking-tight text-foreground sm:inline">
            Memskool
          </span>
          <div className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
          <span
            aria-hidden
            className="accent-rail pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
          />
        </header>

        <main
          id="main"
          className="page-enter mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 md:pb-8"
        >
          <IdentityGate>
            <IdentityBanners />
            <AppErrorBoundary>
              <RouteGuard>{children}</RouteGuard>
            </AppErrorBoundary>
          </IdentityGate>
        </main>

        <SiteFooter className="hidden md:block md:pb-8" />
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
