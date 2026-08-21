import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";
import { lookupSchoolByCode } from "@/lib/school-lookup.functions";


export type MemberStatus = "pending" | "approved" | "rejected";

export type SchoolSummary = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

/** Public School-ID lookup used during signup (no session required). */
export async function lookupSchool(code: string): Promise<SchoolSummary | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const row = await lookupSchoolByCode({ data: { code: trimmed } });
  return row ? (row as SchoolSummary) : null;
}


/** The school this account belongs to (owned school for institutions). */
export function useMySchool(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-school", userId],
    enabled: !!userId,
    queryFn: async () => {
      const owned = await supabase
        .from("schools")
        .select("id, name, code, city, country, contact_email, website, logo_url, admissions_open")
        .eq("owner_id", userId!)
        .maybeSingle();
      if (owned.error) throw owned.error;
      if (owned.data) return { ...owned.data, membership: "owner" as const };

      const member = await supabase
        .from("school_members")
        .select(
          "status, role, student_code, school:schools(id, name, code, city, country, contact_email, website, logo_url, admissions_open)",
        )
        .eq("user_id", userId!)
        .maybeSingle();
      if (member.error) throw member.error;
      if (!member.data?.school) return null;
      return {
        ...member.data.school,
        membership: member.data.status as MemberStatus,
        memberRole: member.data.role as AppRole,
        studentCode: member.data.student_code,
      };
    },
  });
}

/** Membership requests + roster for a school the user owns. */
export function useSchoolMembers(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-members", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_members")
        .select("id, role, status, student_code, created_at, user:profiles(id, full_name, email)")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetMemberStatus(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MemberStatus }) => {
      const { error } = await supabase.from("school_members").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-members", schoolId] }),
  });
}

export function useSchoolRoster(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-roster", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_roster")
        .select("id, full_name, role, student_code, email, claimed_by, created_at")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type RosterEntry = {
  full_name: string;
  role: AppRole;
  student_code?: string | null;
  email?: string | null;
};

export function useAddRoster(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: RosterEntry[]) => {
      if (!schoolId) throw new Error("No school");
      const { error } = await supabase
        .from("school_roster")
        .insert(rows.map((r) => ({ ...r, school_id: schoolId })));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-roster", schoolId] }),
  });
}

export function useRemoveRoster(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_roster").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-roster", schoolId] }),
  });
}

/**
 * Parses pasted roster text. One person per line:
 *   Full Name, STUDENT-ID, email@example.com
 */
export function parseRoster(text: string, role: AppRole): RosterEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, second, third] = line.split(",").map((p) => p.trim());
      const parts = [second, third].filter(Boolean) as string[];
      const email = parts.find((p) => p.includes("@")) ?? null;
      const code = parts.find((p) => !p.includes("@")) ?? null;
      return {
        full_name: name ?? line,
        role,
        student_code: role === "student" ? code : null,
        email,
      };
    })
    .filter((r) => r.full_name.length > 0);
}
