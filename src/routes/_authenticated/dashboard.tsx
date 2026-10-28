import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useSession, useProfile, useRole } from "@/hooks/useAuth";
import { PageHeader, ListSkeleton } from "@/components/app/primitives";

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

const StudentDashboard = lazy(() =>
  import("@/components/dashboards/StudentDashboard").then((m) => ({ default: m.StudentDashboard })),
);
const TeacherDashboard = lazy(() =>
  import("@/components/dashboards/TeacherDashboard").then((m) => ({ default: m.TeacherDashboard })),
);
const ParentDashboard = lazy(() =>
  import("@/components/dashboards/ParentDashboard").then((m) => ({ default: m.ParentDashboard })),
);
const AdminDashboard = lazy(() =>
  import("@/components/dashboards/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);
const InstitutionDashboard = lazy(() =>
  import("@/components/dashboards/InstitutionDashboard").then((m) => ({
    default: m.InstitutionDashboard,
  })),
);
const SuperadminDashboard = lazy(() =>
  import("@/components/dashboards/SuperadminDashboard").then((m) => ({
    default: m.SuperadminDashboard,
  })),
);

const SUBTITLES: Record<string, string> = {
  student: "Your classes, assignments and locker.",
  teacher: "Live lessons, grading and the classes you teach.",
  parent: "Attendance and released results for your linked child.",
  admin: "People, classes and school operations.",
  institution: "Members, approvals and admissions for your school.",
  superadmin: "Platform operator — school workspaces stay separate.",
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
      <Suspense fallback={<ListSkeleton rows={6} />}>
        {role === "teacher" ? (
          <TeacherDashboard user={user} />
        ) : role === "parent" ? (
          <ParentDashboard user={user} />
        ) : role === "institution" ? (
          <InstitutionDashboard user={user} />
        ) : role === "admin" ? (
          <AdminDashboard />
        ) : role === "superadmin" ? (
          <SuperadminDashboard />
        ) : (
          <StudentDashboard user={user} />
        )}
      </Suspense>
    </>
  );
}
