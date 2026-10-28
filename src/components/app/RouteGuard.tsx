import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, Lock } from "lucide-react";
import { useAccess } from "@/lib/access";
import { canAccessRoute } from "@/lib/nav";
import { EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

/**
 * Keeps every workspace honest: a role only reaches the destinations in its
 * own navigation, and staff waiting on school approval only see the basics.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, loading, pendingApproval, hasSchool, schoolName } = useAccess();

  if (loading) return <ListSkeleton rows={4} />;
  if (canAccessRoute(role, pathname, pendingApproval)) return <>{children}</>;

  if (pendingApproval) {
    return (
      <EmptyState
        icon={Clock}
        title="Waiting for school approval"
        hint={
          hasSchool
            ? `${schoolName ?? "Your school"} has not approved your teacher account yet. School classes stay locked. Gold stays available.`
            : "Apply to a school from your dashboard, or teach on Gold, without waiting for a school."
        }
        action={
          <Button asChild className="rounded-full">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={Lock}
      title="Not part of your workspace"
      hint="This area belongs to a different Memskool role."
      action={
        <Button asChild className="rounded-full">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
