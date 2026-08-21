import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Users, GraduationCap, ClipboardList, Building2, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
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

export function InstitutionDashboard({ user }: { user: User }) {
  const school = useMySchool(user.id);
  const schoolId = school.data?.id;
  const members = useSchoolMembers(schoolId);
  const roster = useSchoolRoster(schoolId);
  const setStatus = useSetMemberStatus(schoolId);

  const rows = members.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const students = rows.filter((r) => r.role === "student" && r.status === "approved");
  const teachers = rows.filter((r) => r.role === "teacher" && r.status === "approved");

  if (school.isLoading) return <ListSkeleton rows={4} />;

  if (!school.data) {
    return (
      <EmptyState
        icon={Building2}
        title="No school registered on this account yet"
        hint="Open School Admin to register your institution and get your School ID."
      />
    );
  }

  const code = "code" in school.data ? (school.data.code as string) : "";

  return (
    <div className="space-y-6">
      <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">School ID</p>
          <p className="font-display text-2xl font-bold tracking-tight">{code}</p>
          <p className="truncate text-sm text-muted-foreground">
            Share this with your students and teachers so they can join {school.data.name}.
          </p>
        </div>
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

      <Panel
        title="Join requests"
        description="Approve the people who asked to join your school"
      >
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
                  <p className="truncate text-sm font-medium">
                    {memberName(m.user)}
                  </p>
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
