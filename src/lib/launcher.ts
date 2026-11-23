/**
 * Google-style launcher data (UI uplift): a colour and one-line purpose for every
 * destination, plus the most common jobs per role as one-tap quick actions.
 * Destinations still come from `navForRole`, so access rules stay in one place.
 */
import {
  CalendarDays,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  MessageSquarePlus,
  PenLine,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/hooks/useAuth";

export type TileTone = "navy" | "gold" | "sky" | "leaf" | "rose" | "violet";

export const TILE_CLASS: Record<TileTone, string> = {
  navy: "bg-primary text-primary-foreground",
  gold: "bg-gold text-[oklch(0.22_0.05_262)]",
  sky: "bg-sky text-white",
  leaf: "bg-leaf text-white",
  rose: "bg-[oklch(0.63_0.17_15)] text-white",
  violet: "bg-[oklch(0.5_0.14_290)] text-white",
};

/** Per-destination colour and plain-language purpose. Unknown urls fall back to navy. */
export const APP_META: Record<string, { tone: TileTone; blurb: string }> = {
  "/dashboard": { tone: "navy", blurb: "Your day at a glance" },
  "/virtual-classroom": { tone: "leaf", blurb: "Join or start a live lesson" },
  "/assessments": { tone: "violet", blurb: "Quizzes, tests and results" },
  "/grades": { tone: "gold", blurb: "Marks, gradebook and report cards" },
  "/messages": { tone: "sky", blurb: "Chat with your school" },
  "/timetable": { tone: "rose", blurb: "Lessons this week" },
  "/missed-work": { tone: "gold", blurb: "Catch up on lessons you missed" },
  "/locker": { tone: "navy", blurb: "Your notes and files" },
  "/library": { tone: "leaf", blurb: "Books and reading" },
  "/ai-tutor": { tone: "violet", blurb: "Homework help" },
  "/dream-school": { tone: "sky", blurb: "Find and apply to schools" },
  "/marketplace": { tone: "rose", blurb: "Books and study materials" },
  "/school-admin": { tone: "navy", blurb: "People, classes and admissions" },
  "/gold": { tone: "gold", blurb: "Tutoring classes" },
  "/gold-admin": { tone: "gold", blurb: "Review tutors and classes" },
  "/home": { tone: "sky", blurb: "Short learning videos" },
  "/home-studio": { tone: "sky", blurb: "Publish learning videos" },
  "/home-admin": { tone: "sky", blurb: "Review videos" },
  "/settings": { tone: "navy", blurb: "Profile, alerts and password" },
};

export type QuickAction = {
  label: string;
  blurb: string;
  icon: LucideIcon;
  tone: TileTone;
  to: string;
  search?: Record<string, string>;
  /** Hidden for teachers awaiting approval (school tools locked). */
  needsSchool?: boolean;
};

const STUDENT: QuickAction[] = [
  {
    label: "Join live class",
    blurb: "See who is teaching now",
    icon: Video,
    tone: "leaf",
    to: "/virtual-classroom",
  },
  {
    label: "Do a test",
    blurb: "Quizzes open for you",
    icon: ClipboardCheck,
    tone: "violet",
    to: "/assessments",
  },
  {
    label: "My report card",
    blurb: "Marks and attendance",
    icon: GraduationCap,
    tone: "gold",
    to: "/grades",
  },
  {
    label: "Message a teacher",
    blurb: "Ask a question",
    icon: MessageSquarePlus,
    tone: "sky",
    to: "/messages",
  },
];

const TEACHER: QuickAction[] = [
  {
    label: "Start live class",
    blurb: "Open a lesson now",
    icon: Video,
    tone: "leaf",
    to: "/virtual-classroom",
    needsSchool: true,
  },
  {
    label: "Gradebook",
    blurb: "Mark and track work",
    icon: PenLine,
    tone: "gold",
    to: "/grades",
    needsSchool: true,
  },
  {
    label: "New assessment",
    blurb: "Build a timed quiz",
    icon: ClipboardCheck,
    tone: "violet",
    to: "/assessments",
    needsSchool: true,
  },
  {
    label: "Messages",
    blurb: "Talk with your school",
    icon: MessageSquarePlus,
    tone: "sky",
    to: "/messages",
  },
];

const PARENT: QuickAction[] = [
  {
    label: "Report card",
    blurb: "Your child's results",
    icon: GraduationCap,
    tone: "gold",
    to: "/grades",
  },
  {
    label: "Timetable",
    blurb: "This week's lessons",
    icon: CalendarDays,
    tone: "rose",
    to: "/timetable",
  },
  {
    label: "Test results",
    blurb: "Released results",
    icon: ClipboardCheck,
    tone: "violet",
    to: "/assessments",
  },
  {
    label: "Message school",
    blurb: "Talk to teachers",
    icon: MessageSquarePlus,
    tone: "sky",
    to: "/messages",
  },
];

const SCHOOL: QuickAction[] = [
  {
    label: "Add people",
    blurb: "Bulk import students",
    icon: UserPlus,
    tone: "leaf",
    to: "/school-admin",
    search: { tab: "people" },
  },
  {
    label: "Admissions",
    blurb: "Approve join requests",
    icon: Users,
    tone: "sky",
    to: "/school-admin",
    search: { tab: "people" },
  },
  {
    label: "Classes & timetable",
    blurb: "Set up the school",
    icon: CalendarDays,
    tone: "rose",
    to: "/school-admin",
    search: { tab: "classes" },
  },
  {
    label: "Gradebook",
    blurb: "Results and report cards",
    icon: GraduationCap,
    tone: "gold",
    to: "/grades",
  },
  {
    label: "Notices",
    blurb: "Announce to the school",
    icon: FileUp,
    tone: "violet",
    to: "/school-admin",
    search: { tab: "notices" },
  },
];

export function quickActionsFor(role: AppRole | undefined, pendingApproval = false): QuickAction[] {
  const list =
    role === "teacher"
      ? TEACHER
      : role === "parent"
        ? PARENT
        : role === "institution" || role === "admin"
          ? SCHOOL
          : role === "superadmin"
            ? []
            : STUDENT;
  return pendingApproval ? list.filter((a) => !a.needsSchool) : list;
}
