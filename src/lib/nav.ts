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
  Award,
  House,
  Clapperboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppRole } from "@/hooks/useAuth";

export type NavAccent = "navy" | "gold" | "sky" | "leaf";

export type NavGroupId =
  | "school"
  | "study"
  | "explore"
  | "teaching"
  | "family"
  | "operations"
  | "publish"
  | "platform"
  | "account";

export type NavItem = {
  /** Label in the collapsed mobile tab bar / sidebar. */
  title: string;
  url: string;
  icon: LucideIcon;
  /** Shorter label used by the mobile bottom bar. */
  short?: string;
  /** Optional product colour used by nav chrome. */
  accent?: NavAccent;
  /** Sidebar section this destination belongs to. */
  group?: NavGroupId;
};

export const NAV_GROUP_LABEL: Record<NavGroupId, string> = {
  school: "School",
  study: "Study",
  explore: "Explore",
  teaching: "Teaching",
  family: "Your child",
  operations: "School operations",
  publish: "Publish",
  platform: "Platform",
  account: "Account",
};

const ITEM = {
  dashboard: {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    short: "Home",
    group: "school",
  },
  locker: {
    title: "Locker",
    url: "/locker",
    icon: Archive,
    short: "Locker",
    group: "study",
  },
  missed: {
    title: "Missed Work",
    url: "/missed-work",
    icon: AlarmClock,
    short: "Missed",
    group: "school",
  },
  classroom: {
    title: "Live class",
    url: "/virtual-classroom",
    icon: Video,
    short: "Live",
    accent: "leaf",
    group: "school",
  },
  timetable: {
    title: "Timetable",
    url: "/timetable",
    icon: CalendarDays,
    short: "Timetable",
    group: "school",
  },
  messages: {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
    short: "Chats",
    group: "study",
  },
  library: {
    title: "Library",
    url: "/library",
    icon: BookOpen,
    short: "Library",
    group: "study",
  },
  tutor: { title: "AI Tutor", url: "/ai-tutor", icon: Bot, short: "Tutor", group: "study" },
  assessments: {
    title: "Assessments",
    url: "/assessments",
    icon: ClipboardCheck,
    short: "Tests",
    group: "school",
  },
  dream: {
    title: "Dream School",
    url: "/dream-school",
    icon: Sparkles,
    short: "Schools",
    group: "explore",
  },
  marketplace: {
    title: "Bookstore",
    url: "/marketplace",
    icon: ShoppingBag,
    short: "Store",
    group: "explore",
  },
  schoolAdmin: {
    title: "School Admin",
    url: "/school-admin",
    icon: Building2,
    short: "Admin",
    group: "operations",
  },
  gold: {
    title: "Gold",
    url: "/gold",
    icon: Award,
    short: "Gold",
    accent: "gold",
    group: "explore",
  },
  goldAdmin: {
    title: "Gold review",
    url: "/gold-admin",
    icon: Award,
    short: "Gold",
    accent: "gold",
    group: "platform",
  },
  home: {
    title: "Home",
    url: "/home",
    icon: House,
    short: "Watch",
    accent: "sky",
    group: "explore",
  },
  homeStudio: {
    title: "Home studio",
    url: "/home-studio",
    icon: Clapperboard,
    short: "Publish",
    accent: "sky",
    group: "publish",
  },
  homeAdmin: {
    title: "Home review",
    url: "/home-admin",
    icon: House,
    short: "Home",
    accent: "sky",
    group: "platform",
  },
  settings: {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    short: "Settings",
    group: "account",
  },
} satisfies Record<string, NavItem>;

const teacherTeaching = {
  ...ITEM.classroom,
  title: "Live class",
  group: "teaching" as const,
};
const teacherDash = { ...ITEM.dashboard, group: "teaching" as const };
const teacherAssess = { ...ITEM.assessments, group: "teaching" as const };
const teacherTime = { ...ITEM.timetable, group: "teaching" as const };
const teacherLib = { ...ITEM.library, group: "teaching" as const };
const teacherMsg = { ...ITEM.messages, group: "teaching" as const };
const teacherGold = { ...ITEM.gold, group: "publish" as const };

const parentDash = { ...ITEM.dashboard, group: "family" as const };
const parentTime = { ...ITEM.timetable, group: "family" as const };
const parentAssess = { ...ITEM.assessments, group: "family" as const };
const parentMsg = { ...ITEM.messages, group: "family" as const };

const opsDash = { ...ITEM.dashboard, group: "operations" as const };
const opsClass = { ...ITEM.classroom, group: "operations" as const };
const opsMsg = { ...ITEM.messages, group: "operations" as const };

/**
 * Each role gets only the tools for that job. Students learn, teachers teach,
 * parents follow a linked child, schools run the institution.
 */
const BY_ROLE: Record<AppRole, NavItem[]> = {
  student: [
    ITEM.dashboard,
    ITEM.classroom,
    ITEM.assessments,
    ITEM.messages,
    ITEM.timetable,
    ITEM.missed,
    ITEM.locker,
    ITEM.library,
    ITEM.tutor,
    ITEM.dream,
    ITEM.gold,
    ITEM.home,
    ITEM.marketplace,
    ITEM.settings,
  ],
  teacher: [
    teacherDash,
    teacherTeaching,
    teacherAssess,
    teacherMsg,
    teacherTime,
    teacherLib,
    teacherGold,
    ITEM.homeStudio,
    ITEM.settings,
  ],
  parent: [parentDash, parentTime, parentAssess, parentMsg, ITEM.settings],
  institution: [
    opsDash,
    ITEM.schoolAdmin,
    opsClass,
    opsMsg,
    ITEM.homeStudio,
    ITEM.settings,
  ],
  admin: [
    opsDash,
    ITEM.schoolAdmin,
    opsClass,
    opsMsg,
    ITEM.homeStudio,
    ITEM.settings,
  ],
  superadmin: [
    { ...ITEM.dashboard, group: "platform" },
    ITEM.homeAdmin,
    ITEM.goldAdmin,
    ITEM.settings,
  ],
};

/** School teaching tools that stay locked until the school approves a teacher. */
export const PENDING_SCHOOL_LOCK = ["/virtual-classroom", "/assessments", "/timetable", "/library"];
/** @deprecated Use PENDING_SCHOOL_LOCK. Kept so older imports keep compiling. */
export const PENDING_ALLOWED = ["/dashboard", "/gold", "/home-studio", "/messages", "/settings"];

/** Navigation for a role, with exam-mode and approval restrictions applied. */
export function navForRole(
  role: AppRole | undefined,
  examActive: boolean,
  pendingApproval = false,
): NavItem[] {
  let items = BY_ROLE[role ?? "student"] ?? BY_ROLE.student;
  if (examActive) items = items.filter((i) => i.url !== "/ai-tutor");
  if (pendingApproval) {
    items = items.filter((i) => !PENDING_SCHOOL_LOCK.includes(i.url));
  }
  return items;
}

/** Whether a path belongs to this nav destination (nested routes, not sibling prefixes). */
export function navPathActive(pathname: string, url: string): boolean {
  if (pathname === url) return true;
  if (url === "/dashboard") return false;
  return pathname.startsWith(`${url}/`);
}

const MOBILE_TAB_URLS: Record<AppRole, string[]> = {
  student: ["/dashboard", "/virtual-classroom", "/assessments"],
  teacher: ["/dashboard", "/virtual-classroom", "/assessments"],
  parent: ["/dashboard", "/timetable", "/assessments"],
  institution: ["/dashboard", "/school-admin", "/virtual-classroom"],
  admin: ["/dashboard", "/school-admin", "/virtual-classroom"],
  superadmin: ["/dashboard", "/home-admin", "/settings"],
};

/** Three thumb-friendly destinations for the mobile bar. Everything else is in Menu. */
export function mobileTabsForRole(
  role: AppRole | undefined,
  examActive: boolean,
  pendingApproval = false,
): NavItem[] {
  const items = navForRole(role, examActive, pendingApproval);
  const preferred = MOBILE_TAB_URLS[role ?? "student"] ?? MOBILE_TAB_URLS.student;
  const picked: NavItem[] = [];
  for (const url of preferred) {
    const match = items.find((item) => item.url === url);
    if (match) picked.push(match);
  }
  if (picked.length >= 3) return picked.slice(0, 3);
  for (const item of items) {
    if (picked.some((row) => row.url === item.url)) continue;
    picked.push(item);
    if (picked.length >= 3) break;
  }
  return picked;
}

export function groupedNav(
  items: NavItem[],
): { id: NavGroupId; label: string; items: NavItem[] }[] {
  const order: NavGroupId[] = [];
  const map = new Map<NavGroupId, NavItem[]>();
  for (const item of items) {
    const id = item.group ?? "school";
    if (!map.has(id)) {
      order.push(id);
      map.set(id, []);
    }
    map.get(id)!.push(item);
  }
  return order.map((id) => ({
    id,
    label: NAV_GROUP_LABEL[id],
    items: map.get(id) ?? [],
  }));
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
  if (path.startsWith("/gold")) {
    return allowed.includes("/gold") || allowed.includes("/gold-admin");
  }
  if (path.startsWith("/home-admin")) return allowed.includes("/home-admin");
  if (path.startsWith("/home-studio")) {
    return (
      allowed.includes("/home-studio") ||
      role === "teacher" ||
      role === "student" ||
      role === "institution" ||
      role === "admin"
    );
  }
  if (path === "/home" || path.startsWith("/home/")) return true;
  if (
    (role === "institution" || role === "admin") &&
    ["/timetable", "/assessments", "/library", "/marketplace"].some(
      (url) => path === url || path.startsWith(`${url}/`),
    )
  ) {
    return true;
  }
  return allowed.some((url) => path === url || path.startsWith(`${url}/`));
}

/** Roles allowed to manage a school. */
export function canManageSchool(role: AppRole | undefined): boolean {
  return role === "admin" || role === "institution";
}
