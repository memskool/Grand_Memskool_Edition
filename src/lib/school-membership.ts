import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/hooks/useAuth";
import type { UserProfile } from "@/types/user";
import { lookupSchoolByCode } from "@/lib/school-lookup.functions";
import { rosterLookupId } from "@/lib/school-ids";
import {
  COLLECTIONS,
  createDoc,
  findMany,
  getById,
  patchById,
  removeById,
  setById,
  where,
  orderBy,
} from "@/lib/firebase/repo";
import type { School } from "@/types/school";
import { classifyFirebase } from "@/lib/errors/app-error";
import {
  loadMyManagedSchool,
  openManagedSchool,
} from "@/features/auth/services/session-account.functions";
import { refreshAuthClaims } from "@/features/auth/services/auth.service";
import { seedSessionAfterSignup } from "@/features/auth/seed-session";
import { listSchoolMembers, setSchoolMemberStatus } from "@/lib/members.functions";

export type MemberStatus = "pending" | "approved" | "rejected";

export type SchoolSummary = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export async function lookupSchool(code: string): Promise<SchoolSummary | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const row = await lookupSchoolByCode({ data: { code: trimmed } });
  return row ? (row as SchoolSummary) : null;
}

function unwrapManagedSchool(raw: unknown):
  | (School & {
      id: string;
      membership: MemberStatus | "owner";
      memberRole: AppRole;
    })
  | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["id"] === "string" && typeof obj["name"] === "string") {
    return raw as School & {
      id: string;
      membership: MemberStatus | "owner";
      memberRole: AppRole;
    };
  }
  for (const key of ["data", "result", "payload", "value"]) {
    const nested = obj[key];
    const inner = unwrapManagedSchool(nested);
    if (inner) return inner;
  }
  return null;
}

export function useMySchool(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-school", userId],
    enabled: !!userId,
    staleTime: 60_000,
    retry: 2,
    queryFn: async () => {
      try {
        const fromServer = unwrapManagedSchool(await loadMyManagedSchool());
        if (fromServer) {
          return {
            ...fromServer,
            membership: fromServer.membership,
            memberRole: fromServer.memberRole,
            studentCode: null as string | null,
          };
        }
      } catch (error) {
        console.error("[my-school] server load failed:", error);
      }
      try {
        const [profile, ownedDirect] = await Promise.all([
          getById<UserProfile>(COLLECTIONS.users, userId!),
          getById<School>(COLLECTIONS.schools, userId!),
        ]);
        const schoolId = profile?.school_id || (ownedDirect ? userId! : null);
        if (!schoolId) return null;
        const school =
          schoolId === userId && ownedDirect
            ? ownedDirect
            : await getById<School>(COLLECTIONS.schools, schoolId);
        if (!school) return null;
        const membership: MemberStatus | "owner" =
          profile?.membership_status === "owner" ||
          profile?.role === "institution" ||
          profile?.role === "admin" ||
          Boolean(ownedDirect)
            ? "owner"
            : profile?.membership_status === "pending" ||
                profile?.membership_status === "rejected" ||
                profile?.membership_status === "approved"
              ? profile.membership_status
              : "approved";
        return {
          ...school,
          membership,
          memberRole: profile?.role ?? "institution",
          studentCode: profile?.student_code ?? null,
        };
      } catch (error) {
        console.error("[my-school] client load failed:", error);
        return null;
      }
    },
  });
}

export function useOpenManagedSchool(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (schoolId: string) => {
      const raw = await openManagedSchool({ data: { schoolId } });
      const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
      const nested =
        payload && payload["data"] && typeof payload["data"] === "object"
          ? (payload["data"] as Record<string, unknown>)
          : payload;
      const profile = nested?.["profile"] as UserProfile | undefined;
      if (profile?.id) {
        seedSessionAfterSignup(qc, {
          userId: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          role: profile.role === "admin" ? "institution" : profile.role,
          schoolId: profile.school_id,
          membership: profile.membership_status ?? "owner",
          studentCode: profile.student_code,
        });
      }
      await refreshAuthClaims();
      return nested;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-school", userId] });
      void qc.invalidateQueries({ queryKey: ["profile", userId] });
      void qc.invalidateQueries({ queryKey: ["role", userId] });
      void qc.invalidateQueries({ queryKey: ["schools"] });
    },
  });
}

export function useUpdateSchoolCode(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ schoolId, code }: { schoolId: string; code: string }) => {
      const next = code.trim().toUpperCase();
      if (!/^[A-Z0-9-]{3,24}$/.test(next)) {
        throw new Error("School ID must be 3–24 letters, numbers or dashes.");
      }
      try {
        await patchById(COLLECTIONS.schools, schoolId, {
          code: next,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        throw classifyFirebase(error);
      }
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-school", userId] });
    },
  });
}

export function useRequestTeacherJoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (schoolCode: string) => {
      const { requestTeacherSchoolJoin } = await import("@/lib/members.functions");
      return requestTeacherSchoolJoin({ data: { schoolCode } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-school"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["role"] });
    },
  });
}

export function useRemindSchool() {
  return useMutation({
    mutationFn: async (schoolId: string) => {
      const { remindSchoolApproval } = await import("@/lib/members.functions");
      await remindSchoolApproval({ data: { schoolId } });
    },
  });
}

export function useSchoolMembers(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-members", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      try {
        const raw = await listSchoolMembers();
        if (Array.isArray(raw)) {
          return raw as Array<{
            id: string;
            role: AppRole;
            status: MemberStatus;
            student_code: string | null;
            created_at: string;
            user_id: string;
            user: { id: string; full_name: string; email: string | null } | null;
          }>;
        }
      } catch (error) {
        console.error("[school-members] server list failed:", error);
      }
      const members = await findMany<{
        role: AppRole;
        status: MemberStatus;
        student_code: string | null;
        created_at: string;
        user_id: string;
      }>(COLLECTIONS.schoolMembers, [
        where("school_id", "==", schoolId!),
        orderBy("created_at", "desc"),
      ]);
      return Promise.all(
        members.map(async (m) => {
          const user = await getById<{ full_name: string; email: string | null }>(
            COLLECTIONS.users,
            m.user_id,
          );
          return {
            ...m,
            user: user ? { id: user.id, full_name: user.full_name, email: user.email } : null,
          };
        }),
      );
    },
  });
}

export function useSetMemberStatus(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MemberStatus }) => {
      await setSchoolMemberStatus({ data: { memberId: id, status } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["school-members", schoolId] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["my-school"] });
    },
  });
}

export function useSchoolRoster(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-roster", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      return findMany(COLLECTIONS.schoolRoster, [
        where("school_id", "==", schoolId!),
        orderBy("created_at", "desc"),
      ]);
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
      const now = new Date().toISOString();
      await Promise.all(
        rows.map((r) => {
          const id = r.student_code ? rosterLookupId(schoolId, r.student_code) : undefined;
          if (id) {
            return setById(COLLECTIONS.schoolRoster, id, {
              ...r,
              school_id: schoolId,
              claimed_by: null,
              created_at: now,
            });
          }
          return createDoc(COLLECTIONS.schoolRoster, {
            ...r,
            school_id: schoolId,
            claimed_by: null,
            created_at: now,
          });
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-roster", schoolId] }),
  });
}

export function useRemoveRoster(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await removeById(COLLECTIONS.schoolRoster, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-roster", schoolId] }),
  });
}

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

export function useSchoolFamilyLinks(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["family-links", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const rows = await findMany<{
        parent_id: string;
        student_id: string;
        school_id: string;
        created_at?: string;
      }>(COLLECTIONS.parentStudents, [where("school_id", "==", schoolId!)]);
      return Promise.all(
        rows.map(async (row) => {
          const [parent, student] = await Promise.all([
            getById<{ full_name: string }>(COLLECTIONS.users, row.parent_id),
            getById<{ full_name: string }>(COLLECTIONS.users, row.student_id),
          ]);
          return {
            ...row,
            parentName: parent?.full_name ?? "Parent",
            studentName: student?.full_name ?? "Student",
          };
        }),
      );
    },
  });
}

export function useLinkParentStudent(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { parentId: string; studentId: string }) => {
      const { linkParentStudent } = await import("@/lib/members.functions");
      await linkParentStudent({ data: input });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-links", schoolId] });
      qc.invalidateQueries({ queryKey: ["children"] });
    },
  });
}

export function useUnlinkParentStudent(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { unlinkParentStudent } = await import("@/lib/members.functions");
      await unlinkParentStudent({ data: { linkId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-links", schoolId] });
      qc.invalidateQueries({ queryKey: ["children"] });
    },
  });
}
