import { Users, BookOpen, Library, ShieldCheck } from "lucide-react";
import { useSchoolOverview } from "@/lib/school-data";
import { StatCard, Panel, ListSkeleton } from "@/components/app/primitives";
import { BehaviourPanel } from "@/components/app/BehaviourPanel";
import { useSession } from "@/hooks/useAuth";

const ROLE_LABELS: Record<string, string> = {
  student: "Students",
  teacher: "Teachers",
  parent: "Parents",
  admin: "Admins",
};

export function AdminDashboard() {
  const overview = useSchoolOverview(true);
  const { user } = useSession();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="People"
          value={overview.data?.people ?? 0}
          icon={Users}
          loading={overview.isLoading}
        />
        <StatCard
          label="Classes"
          value={overview.data?.classes ?? 0}
          icon={BookOpen}
          tone="success"
          loading={overview.isLoading}
        />
        <StatCard
          label="Subjects"
          value={overview.data?.subjects ?? 0}
          icon={Library}
          tone="warning"
          loading={overview.isLoading}
        />
        <StatCard
          label="Role assignments"
          value={Object.values(overview.data?.roleCounts ?? {}).reduce((a, b) => a + b, 0)}
          icon={ShieldCheck}
          loading={overview.isLoading}
        />
      </div>

      <Panel title="Community breakdown" description="Accounts by assigned role">
        {overview.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.keys(ROLE_LABELS).map((role) => (
              <li key={role} className="rounded-xl bg-secondary/50 px-4 py-3">
                <p className="font-display text-2xl font-semibold">
                  {overview.data?.roleCounts[role] ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <BehaviourPanel staffId={user?.id} />
    </div>
  );
}
