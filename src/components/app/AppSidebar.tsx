import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Archive,
  AlarmClock,
  Video,
  MessageSquare,
  BookOpen,
  ClipboardCheck,
  Sparkles,
  Settings,
  Bot,
  CalendarDays,
  Building2,
  ShoppingBag,
} from "lucide-react";
import { useExamMode } from "@/lib/exam-mode";
import { useSession, useRole } from "@/hooks/useAuth";
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

const NAV = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Locker", url: "/locker", icon: Archive },
  { title: "Missed Work", url: "/missed-work", icon: AlarmClock },
  { title: "Virtual Classroom", url: "/virtual-classroom", icon: Video },
  { title: "Timetable", url: "/timetable", icon: CalendarDays },
  { title: "Messages", url: "/messages", icon: MessageSquare },

  { title: "Library", url: "/library", icon: BookOpen },
  { title: "AI Tutor", url: "/ai-tutor", icon: Bot },
  { title: "Assessments", url: "/assessments", icon: ClipboardCheck },
  { title: "Dream School", url: "/dream-school", icon: Sparkles },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag },
  { title: "School Admin", url: "/school-admin", icon: Building2 },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const examActive = useExamMode();
  const { user } = useSession();
  const role = useRole(user);
  const items = NAV.filter(
    (i) =>
      !(examActive && i.url === "/ai-tutor") &&
      !(i.url === "/school-admin" && role.data !== "admin"),
  );

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
