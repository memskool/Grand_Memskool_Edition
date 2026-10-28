import { useRouterState } from "@tanstack/react-router";

/** Slim top bar while a route is resolving — keeps navigation feeling instant. */
export function NavigationProgress() {
  const pending = useRouterState({ select: (s) => s.status === "pending" });

  if (!pending) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px] overflow-hidden bg-primary/10"
    >
      <span
        className="accent-rail block h-full w-1/3"
        style={{ animation: "memskool-indeterminate 0.9s ease-in-out infinite" }}
      />
    </div>
  );
}
