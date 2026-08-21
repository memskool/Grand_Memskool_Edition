import { Link, useRouterState } from "@tanstack/react-router";
import { useExamMode } from "@/lib/exam-mode";
import { useSession, useRole } from "@/hooks/useAuth";
import { navForRole } from "@/lib/nav";
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
  const { user } = useSession();
  const role = useRole(user);
  const items = navForRole(role.data, examActive);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <BrandMark size={40} className="invert dark:invert-0" />
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-display text-lg font-bold leading-tight tracking-tight text-sidebar-foreground">
              Memskool
            </span>
            <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/60">
              eSchool
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-11 rounded-full transition-colors data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground"
                    >
                      <Link to={item.url}>
                        <item.icon
                          className={active ? "size-[18px] text-primary" : "size-[18px]"}
                        />
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
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Memskool eSchool
          <br />
          Learn. Track. Grow.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
