import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { ListSkeleton } from "@/components/app/primitives";

/** Keeps incomplete profiles out of the workspace until onboarding finishes. */
export function IdentityGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { accountState, role } = useAccess();
  const isOperator = role === "institution" || role === "admin" || role === "superadmin";

  useEffect(() => {
    if (accountState === "unauthenticated") {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (accountState === "incomplete" && !isOperator) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [accountState, isOperator, navigate]);

  if (accountState === "loading" || accountState === "unauthenticated") {
    return <ListSkeleton rows={4} />;
  }
  // School operators must stay in School Admin even if profile cache blips.
  if (accountState === "incomplete" && !isOperator) {
    return <ListSkeleton rows={4} />;
  }

  return <>{children}</>;
}
