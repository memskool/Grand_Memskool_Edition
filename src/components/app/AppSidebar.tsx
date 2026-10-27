import { Link, useRouterState } from "@tanstack/react-router";
import { useExamMode } from "@/lib/exam-mode";
import { useAccess } from "@/lib/access";
import { navForRole, navPathActive } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/app/BrandMark";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const examActive = useExamMode();
  const { role, pendingApproval } = useAccess();
  const items = navForRole(role, examActive, pendingApproval);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <BrandMark size={40} />
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-display text-lg font-bold leading-tight tracking-tight text-sidebar-foreground">
              Memskool
            </span>
            <span className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/55">
              Workspace
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = navPathActive(pathname, item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 rounded-lg transition-colors duration-150 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link
                        preload="intent"
                        to={item.url}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="size-[18px]" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 group-data-[collapsible=icon]:hidden">
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/55">
          School workspace
          <br />
          Records stay inside each school.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
