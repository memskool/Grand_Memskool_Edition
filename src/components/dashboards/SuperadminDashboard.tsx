import { Building2, Shield } from "lucide-react";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { useSession, useProfile } from "@/hooks/useAuth";
import { useSchools } from "@/lib/discovery-data";

export function SuperadminDashboard() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const schools = useSchools();

  return (
    <div className="space-y-6">
      <Panel
        title="Platform operator"
        description="This account is not a school workspace. Student records stay inside each school."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{profile?.full_name || user?.displayName || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex items-start gap-2 rounded-2xl bg-secondary/60 px-4 py-3 sm:col-span-2">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <p className="text-muted-foreground">
              You can see which schools exist. Opening another school’s classrooms, marks, or
              messages is intentionally not available from this dashboard.
            </p>
          </div>
        </dl>
      </Panel>

      <Panel title="Schools on this platform" description="Names and locations only">
        {schools.isLoading ? (
          <ListSkeleton rows={4} />
        ) : (schools.data ?? []).length ? (
          <ul className="space-y-2">
            {(schools.data ?? []).slice(0, 50).map((school) => (
              <li
                key={school.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{school.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[school.city, school.country].filter(Boolean).join(", ") || "Location not set"}
                  </p>
                </div>
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Building2}
            title="No schools listed yet"
            hint="Schools appear here after an administrator creates one."
          />
        )}
      </Panel>
    </div>
  );
}
