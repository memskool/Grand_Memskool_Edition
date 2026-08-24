import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { ListSkeleton } from "@/components/app/primitives";

/** Keeps incomplete profiles out of the workspace until onboarding finishes. */
export function IdentityGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { accountState } = useAccess();

  useEffect(() => {
    if (accountState === "incomplete") {
      navigate({ to: "/onboarding", replace: true });
    }
    if (accountState === "unauthenticated") {
      navigate({ to: "/auth", replace: true });
    }
  }, [accountState, navigate]);

  if (
    accountState === "loading" ||
    accountState === "incomplete" ||
    accountState === "unauthenticated"
  ) {
    return <ListSkeleton rows={4} />;
  }

  return <>{children}</>;
}
