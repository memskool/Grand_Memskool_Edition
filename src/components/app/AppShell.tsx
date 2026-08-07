import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { UserMenu } from "@/components/app/UserMenu";
import { NotificationBell } from "@/components/app/NotificationBell";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <SidebarTrigger className="rounded-full" />
          <div className="flex-1" />
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
