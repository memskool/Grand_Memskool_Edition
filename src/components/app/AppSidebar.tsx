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
  GraduationCap,
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Memskool
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="h-11 rounded-full data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium"
                  >
                    <Link to={item.url}>
                      <item.icon className="size-[18px]" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        Memskool eSchool
      </SidebarFooter>
    </Sidebar>
  );
}
