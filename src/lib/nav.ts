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
import type { LucideIcon } from "lucide-react";
import type { AppRole } from "@/hooks/useAuth";

export type NavItem = {
  /** Label in the collapsed mobile tab bar / sidebar. */
  title: string;
  url: string;
  icon: LucideIcon;
  /** Shorter label used by the mobile bottom bar. */
  short?: string;
};

const ITEM = {
  dashboard: { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, short: "Home" },
  locker: { title: "Locker", url: "/locker", icon: Archive, short: "Locker" },
  missed: { title: "Missed Work", url: "/missed-work", icon: AlarmClock, short: "Missed" },
  classroom: { title: "Virtual Classroom", url: "/virtual-classroom", icon: Video, short: "Live" },
  timetable: { title: "Timetable", url: "/timetable", icon: CalendarDays, short: "Timetable" },
  messages: { title: "Messages", url: "/messages", icon: MessageSquare, short: "Chats" },
  library: { title: "Library", url: "/library", icon: BookOpen, short: "Library" },
  tutor: { title: "AI Tutor", url: "/ai-tutor", icon: Bot, short: "Tutor" },
  assessments: {
    title: "Assessments",
    url: "/assessments",
    icon: ClipboardCheck,
    short: "Tests",
  },
  dream: { title: "Dream School", url: "/dream-school", icon: Sparkles, short: "Schools" },
  marketplace: { title: "Marketplace", url: "/marketplace", icon: ShoppingBag, short: "Store" },
  schoolAdmin: { title: "School Admin", url: "/school-admin", icon: Building2, short: "School" },
  settings: { title: "Settings", url: "/settings", icon: Settings, short: "Settings" },
} satisfies Record<string, NavItem>;

/**
 * Each role gets its own workspace. Students and parents are receivers,
 * teachers and institutions are inputters — the navigation reflects that
 * instead of showing everyone the same links.
 */
const BY_ROLE: Record<AppRole, NavItem[]> = {
  student: [
    ITEM.dashboard,
    ITEM.timetable,
    ITEM.classroom,
    ITEM.assessments,
    ITEM.missed,
    ITEM.locker,
    ITEM.library,
    ITEM.tutor,
    ITEM.messages,
    ITEM.dream,
    ITEM.marketplace,
    ITEM.settings,
  ],
  teacher: [
    ITEM.dashboard,
    ITEM.timetable,
    ITEM.classroom,
    ITEM.assessments,
    ITEM.library,
    ITEM.locker,
    ITEM.messages,
    ITEM.marketplace,
    ITEM.settings,
  ],
  parent: [
    ITEM.dashboard,
    ITEM.timetable,
    ITEM.messages,
    ITEM.library,
    ITEM.dream,
    ITEM.marketplace,
    ITEM.settings,
  ],
  institution: [
    ITEM.dashboard,
    ITEM.schoolAdmin,
    ITEM.timetable,
    ITEM.classroom,
    ITEM.assessments,
    ITEM.library,
    ITEM.messages,
    ITEM.marketplace,
    ITEM.settings,
  ],
  admin: [
    ITEM.dashboard,
    ITEM.schoolAdmin,
    ITEM.timetable,
    ITEM.classroom,
    ITEM.assessments,
    ITEM.missed,
    ITEM.locker,
    ITEM.library,
    ITEM.tutor,
    ITEM.messages,
    ITEM.dream,
    ITEM.marketplace,
    ITEM.settings,
  ],
};

/** Routes staff can still use while their school approval is pending. */
export const PENDING_ALLOWED = ["/dashboard", "/messages", "/settings"];

/** Navigation for a role, with exam-mode and approval restrictions applied. */
export function navForRole(
  role: AppRole | undefined,
  examActive: boolean,
  pendingApproval = false,
): NavItem[] {
  let items = BY_ROLE[role ?? "student"] ?? BY_ROLE.student;
  if (examActive) items = items.filter((i) => i.url !== "/ai-tutor");
  if (pendingApproval) items = items.filter((i) => PENDING_ALLOWED.includes(i.url));
  return items;
}

/** Up to four primary destinations for the mobile bottom bar. */
export function mobileTabsForRole(
  role: AppRole | undefined,
  examActive: boolean,
  pendingApproval = false,
): NavItem[] {
  return navForRole(role, examActive, pendingApproval).slice(0, 4);
}

/**
 * Can this role open this path directly? Nav is the source of truth, so a
 * teacher typing /dream-school in the address bar is blocked too.
 */
export function canAccessRoute(
  role: AppRole | undefined,
  path: string,
  pendingApproval = false,
): boolean {
  const allowed = navForRole(role, false, pendingApproval).map((i) => i.url);
  // Exam runner lives under /exam/:id and belongs with Assessments.
  if (path.startsWith("/exam/")) return allowed.includes("/assessments");
  return allowed.some((url) => path === url || path.startsWith(`${url}/`));
}

/** Roles allowed to manage a school. */
export function canManageSchool(role: AppRole | undefined): boolean {
  return role === "admin" || role === "institution";
}

