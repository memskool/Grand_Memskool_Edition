import { createFileRoute } from "@tanstack/react-router";
import { useSession, useProfile, useRole } from "@/hooks/useAuth";
import { PageHeader, ListSkeleton } from "@/components/app/primitives";
import { StudentDashboard } from "@/components/dashboards/StudentDashboard";
import { TeacherDashboard } from "@/components/dashboards/TeacherDashboard";
import { ParentDashboard } from "@/components/dashboards/ParentDashboard";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Memskool" },
      {
        name: "description",
        content:
          "Your personalised Memskool dashboard with classes, assignments, grading and attendance at a glance.",
      },
      { property: "og:title", content: "Memskool Dashboard" },
      {
        property: "og:description",
        content: "Classes, assignments, grading and attendance in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const SUBTITLES: Record<string, string> = {
  student: "Your classes, work and locker at a glance.",
  teacher: "Your teaching day, grading queue and classes.",
  parent: "Attendance and performance for your child.",
  admin: "School-wide overview of people and classes.",
};

function DashboardPage() {
  const { user, loading } = useSession();
  const { data: profile } = useProfile(user ?? null);
  const { data: role, isLoading: roleLoading } = useRole(user ?? null);

  if (loading || roleLoading || !user) {
    return <ListSkeleton rows={4} />;
  }

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        subtitle={SUBTITLES[role ?? "student"] ?? ""}
      />
      {role === "teacher" ? (
        <TeacherDashboard user={user} />
      ) : role === "parent" ? (
        <ParentDashboard user={user} />
      ) : role === "admin" ? (
        <AdminDashboard />
      ) : (
        <StudentDashboard user={user} />
      )}
    </>
  );
}
