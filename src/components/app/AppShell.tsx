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
      <SidebarInset className="bg-background">
        <NetworkBanner />
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/50 bg-background/75 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-6">
          <SidebarTrigger className="rounded-full" />
          <BrandMark size={36} priority />
          <span className="hidden font-display text-sm font-bold tracking-tight text-foreground sm:inline">
            Memskool
          </span>
          <div className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-7 md:pb-8"
        >
          <IdentityGate>
            <IdentityBanners />
            <AppErrorBoundary>
              <RouteGuard>{children}</RouteGuard>
            </AppErrorBoundary>
          </IdentityGate>
        </main>

        <SiteFooter className="pb-24 md:pb-8" />
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
