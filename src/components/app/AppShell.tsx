import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
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
import { PRODUCT_EVENTS, trackProductEvent } from "@/lib/analytics";
import { AppsLauncher } from "@/components/app/AppsLauncher";
import { CommandPalette, SearchPill } from "@/components/app/CommandPalette";
import { usePaletteShortcut } from "@/hooks/usePaletteShortcut";

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    void trackProductEvent(PRODUCT_EVENTS.workspaceOpen);
  }, []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const togglePalette = useCallback(
    (fn: (open: boolean) => boolean) => setPaletteOpen((o) => fn(o)),
    [],
  );
  usePaletteShortcut(togglePalette);
  return (
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-clip bg-background">
        <NetworkBanner />
        <header
          data-print-hide
          className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-border/60 bg-background px-3 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-6"
        >
          <SidebarTrigger className="hidden size-10 rounded-full md:inline-flex" />
          <span className="md:hidden">
            <BrandMark size={32} priority />
          </span>
          <SearchPill onOpen={() => setPaletteOpen(true)} />
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <AppsLauncher />
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

        <main
          id="main"
          className="page-enter mx-auto w-full min-w-0 max-w-6xl flex-1 2xl:max-w-7xl px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 md:pb-8"
        >
          <IdentityGate>
            <IdentityBanners />
            <AppErrorBoundary>
              <RouteGuard>{children}</RouteGuard>
            </AppErrorBoundary>
          </IdentityGate>
        </main>

        <div data-print-hide>
          <SiteFooter className="hidden md:block md:pb-8" />
          <MobileNav />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
