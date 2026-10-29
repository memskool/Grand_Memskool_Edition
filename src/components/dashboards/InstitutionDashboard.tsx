import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { AuthUser } from "@/types/roles";
import { Users, GraduationCap, ClipboardList, Building2, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  useMySchool,
  useSchoolMembers,
  useSchoolRoster,
  useSetMemberStatus,
  useUpdateSchoolCode,
} from "@/lib/school-membership";
import { StatCard, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type MemberUser = { full_name?: string | null; email?: string | null } | null;

function memberName(u: unknown): string {
  const m = (u && typeof u === "object" ? u : null) as MemberUser;
  return m?.full_name || m?.email || "New member";
}

export function InstitutionDashboard({ user }: { user: AuthUser }) {
  const school = useMySchool(user.id);
  const schoolId = school.data?.id;
  const members = useSchoolMembers(schoolId);
  const roster = useSchoolRoster(schoolId);
  const setStatus = useSetMemberStatus(schoolId);
  const updateCode = useUpdateSchoolCode(user.id);
  const [editing, setEditing] = useState(false);
  const [draftCode, setDraftCode] = useState("");

  const rows = members.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const students = rows.filter((r) => r.role === "student" && r.status === "approved");
  const teachers = rows.filter((r) => r.role === "teacher" && r.status === "approved");

  if (school.isLoading) return <ListSkeleton rows={4} />;

  if (school.isError) {
    return (
      <EmptyState
        icon={Building2}
        title="Could not load your school"
        hint="Refresh the page, then open School Admin if your school still does not appear."
        action={
          <Button className="rounded-full" onClick={() => void school.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!school.data) {
    return (
      <EmptyState
        icon={Building2}
        title="No school registered on this account yet"
        hint="Create your school in School Admin to get a School ID. Each institution account can run one school."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="rounded-full"
              onClick={() => void school.refetch()}
              variant="outline"
            >
              Refresh
            </Button>
            <Button asChild className="rounded-full">
              <Link to="/school-admin" search={{ tab: "overview" }}>
                Create school
              </Link>
            </Button>
          </div>
        }
      />
    );
  }

  const code = "code" in school.data ? (school.data.code as string) : "";

  return (
    <div className="space-y-6">
      <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Your school</p>
          <p className="font-display text-2xl font-bold tracking-tight">{school.data.name}</p>
          {editing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
                placeholder="e.g. KMHS-2026"
                className="max-w-xs"
              />
              <Button
                className="rounded-full"
                disabled={updateCode.isPending}
                onClick={() =>
                  updateCode.mutate(
                    { schoolId: school.data!.id, code: draftCode },
                    {
                      onSuccess: (next) => {
                        setEditing(false);
                        toast.success(`School ID updated to ${next}`);
                      },
                      onError: (e) => toast.error(authErrorMessage(e)),
                    },
                  )
                }
              >
                Save
              </Button>
              <Button variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="mt-1 font-display text-lg font-semibold tracking-tight">{code}</p>
          )}
          <p className="truncate text-sm text-muted-foreground">
            {editing
              ? "3–24 letters, numbers or dashes. Members who already joined stay connected."
              : `Share this School ID with students and teachers so they can join ${school.data.name}.`}
          </p>
        </div>
        {editing ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="rounded-full">
              <Link to="/school-admin" search={{ tab: "overview" }}>
                Manage school
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setDraftCode(code);
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 size-4" /> Change ID
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(code);
                toast.success("School ID copied");
              }}
            >
              <Copy className="mr-2 size-4" /> Copy ID
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          asChild
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal rounded-2xl p-4 text-left"
        >
          <Link to="/school-admin" search={{ tab: "people" }}>
            <span>
              <span className="block text-sm font-semibold">People</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Approve teachers and student applications
              </span>
            </span>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal rounded-2xl p-4 text-left"
        >
          <Link to="/school-admin" search={{ tab: "classes" }}>
            <span>
              <span className="block text-sm font-semibold">Classes</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Create a class and enrol approved learners
              </span>
            </span>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal rounded-2xl p-4 text-left"
        >
          <Link to="/virtual-classroom">
            <span>
              <span className="block text-sm font-semibold">Live class</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Open a lesson for a class
              </span>
            </span>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal rounded-2xl p-4 text-left"
        >
          <Link to="/school-admin" search={{ tab: "notices" }}>
            <span>
              <span className="block text-sm font-semibold">Notices</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Meetings and announcements
              </span>
            </span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={students.length} icon={GraduationCap} />
        <StatCard label="Teachers" value={teachers.length} icon={Users} tone="success" />
        <StatCard
          label="Pending requests"
          value={pending.length}
          icon={ClipboardList}
          tone="warning"
          loading={members.isLoading}
        />
        <StatCard
          label="Roster entries"
          value={roster.data?.length ?? 0}
          icon={Building2}
          loading={roster.isLoading}
        />
      </div>

      <Panel title="Join requests" description="Approve the people who asked to join your school">
        {members.isLoading ? (
          <ListSkeleton rows={2} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No pending requests"
            hint="Manage classes, timetable and roster in School Admin."
          />
        ) : (
          <ul className="space-y-2">
            {pending.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{memberName(m.user)}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {m.role}
                    {m.student_code ? ` · ${m.student_code}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full capitalize">
                    {m.status}
                  </Badge>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: m.id, status: "approved" })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: m.id, status: "rejected" })}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
