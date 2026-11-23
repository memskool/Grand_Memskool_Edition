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
import { LeafCluster } from "@/components/app/art";
import { quickActionsFor } from "@/lib/launcher";
import { ArrowRight } from "lucide-react";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const examActive = useExamMode();
  const { role, pendingApproval } = useAccess();
  const items = navForRole(role, examActive, pendingApproval);
  const groups = groupedNav(items);
  const promo = examActive ? null : (quickActionsFor(role, pendingApproval)[0] ?? null);
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
            <SidebarGroupLabel className="px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
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
                          "h-11 min-h-11 rounded-full px-4 text-sidebar-foreground/80 transition-[background-color,color] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!px-0",
                          "data-[active=true]:bg-white data-[active=true]:font-semibold data-[active=true]:text-[oklch(0.225_0.054_262)] data-[active=true]:shadow-sm data-[active=true]:hover:bg-white",
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

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:hidden">
        {promo ? (
          <Link
            to={promo.to as never}
            {...(promo.search ? { search: promo.search as never } : {})}
            className="group/promo relative block overflow-hidden rounded-3xl bg-[oklch(0.3_0.06_262)] p-4 pb-16 text-sidebar-foreground ring-1 ring-white/10 transition-transform hover:-translate-y-0.5"
          >
            <LeafCluster className="absolute -bottom-3 -right-6 h-28 w-40 opacity-90" />
            <span className="relative flex size-9 items-center justify-center rounded-xl bg-gold text-[oklch(0.225_0.054_262)]">
              <promo.icon className="size-[18px]" />
            </span>
            <p className="relative mt-3 text-sm font-semibold leading-snug">{promo.label}</p>
            <p className="relative mt-0.5 text-xs text-sidebar-foreground/65">{promo.blurb}</p>
            <span className="absolute bottom-4 left-4 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[oklch(0.225_0.054_262)]">
              Open{" "}
              <ArrowRight className="size-3.5 transition-transform group-hover/promo:translate-x-0.5" />
            </span>
          </Link>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
