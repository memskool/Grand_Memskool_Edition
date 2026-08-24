import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentAuthUser } from "@/features/auth/services/auth.service";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async ({ location }) => {
    const user = await getCurrentAuthUser();
    if (!user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.pathname + location.searchStr },
      });
    }
    return { user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
