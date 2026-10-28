import { Link, useRouterState } from "@tanstack/react-router";
import { useExamMode } from "@/lib/exam-mode";
import { useAccess } from "@/lib/access";
import { groupedNav, navForRole, navPathActive } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/app/BrandMark";
import { cn } from "@/lib/utils";
import type { NavAccent } from "@/lib/nav";

const ACCENT: Record<NavAccent, string> = {
  navy: "data-[active=true]:bg-sidebar-accent",
  gold: "data-[active=true]:bg-gold/18 data-[active=true]:text-gold",
  sky: "data-[active=true]:bg-sky/20 data-[active=true]:text-sky",
  leaf: "data-[active=true]:bg-leaf/20 data-[active=true]:text-leaf",
};

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const examActive = useExamMode();
  const { role, pendingApproval } = useAccess();
  const items = navForRole(role, examActive, pendingApproval);
  const groups = groupedNav(items);
  const workspaceLabel =
    role === "parent"
      ? "Family"
      : role === "teacher"
        ? "Teaching"
        : role === "institution" || role === "admin"
          ? "School admin"
          : role === "superadmin"
            ? "Platform"
            : "Student";

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
              {workspaceLabel}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/45">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = navPathActive(pathname, item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          "h-10 rounded-lg transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
                          ACCENT[item.accent ?? "navy"],
                        )}
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
        ))}
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 group-data-[collapsible=icon]:hidden">
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/55">
          {role === "parent"
            ? "Your school links you to your child."
            : role === "teacher"
              ? "Live lessons, marking and class records."
              : role === "institution" || role === "admin"
                ? "People, classes and admissions for this school."
                : "Your classes, locker and assessments."}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
