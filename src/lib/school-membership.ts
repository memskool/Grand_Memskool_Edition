import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/hooks/useAuth";
import type { UserProfile } from "@/types/user";
import { lookupSchoolByCode } from "@/lib/school-lookup.functions";
import { rosterLookupId, schoolCodeKey } from "@/lib/school-ids";
import { getFirebaseAuth } from "@/lib/firebase/client";
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
import { readCachedSchool, writeCachedSchool } from "@/features/auth/account-cache";
import { listSchoolMembers, setSchoolMemberStatus } from "@/lib/members.functions";

export type MemberStatus = "pending" | "approved" | "rejected";

export type SchoolSummary = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

function unwrapTeacherJoin(raw: unknown): { schoolId: string; schoolName: string | null } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["schoolId"] === "string" && obj["schoolId"]) {
    return {
      schoolId: obj["schoolId"],
      schoolName: typeof obj["schoolName"] === "string" ? obj["schoolName"] : null,
    };
  }
  for (const key of ["data", "result", "payload", "value"]) {
    const inner = unwrapTeacherJoin(obj[key]);
    if (inner) return inner;
  }
  return null;
}

function unwrapSchoolSummary(raw: unknown): SchoolSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["id"] === "string" && obj["id"] && typeof obj["name"] === "string") {
    return {
      id: obj["id"],
      name: obj["name"],
      city: typeof obj["city"] === "string" ? obj["city"] : null,
      country: typeof obj["country"] === "string" ? obj["country"] : null,
    };
  }
  for (const key of ["data", "result", "payload", "value"]) {
    const inner = unwrapSchoolSummary(obj[key]);
    if (inner) return inner;
  }
  return null;
}

export async function lookupSchool(code: string): Promise<SchoolSummary | null> {
  const trimmed = schoolCodeKey(code);
  if (trimmed.length < 3) return null;
  try {
    const fromServer = unwrapSchoolSummary(await lookupSchoolByCode({ data: { code: trimmed } }));
    if (fromServer) return fromServer;
  } catch (error) {
    console.error("[lookup-school] server lookup failed:", error);
  }
  const dir = await getById<{
    school_id?: string;
    name?: string;
    city?: string | null;
    country?: string | null;
  }>(COLLECTIONS.schoolDirectory, trimmed);
  if (dir?.school_id) {
    return {
      id: dir.school_id,
      name: dir.name?.trim() || "School",
      city: dir.city ?? null,
      country: dir.country ?? null,
    };
  }
  return null;
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

type MySchoolRow = School & {
  membership: MemberStatus | "owner";
  memberRole: AppRole;
  studentCode: string | null;
};

export function useMySchool(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-school", userId],
    enabled: !!userId,
    staleTime: 60_000,
    retry: 2,
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<MySchoolRow | null> => {
      try {
        const fromServer = unwrapManagedSchool(await loadMyManagedSchool());
        if (fromServer) {
          const row = {
            ...fromServer,
            membership: fromServer.membership,
            memberRole: fromServer.memberRole,
            studentCode: null as string | null,
          };
          writeCachedSchool(userId!, row);
          return row;
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
        if (schoolId) {
          const school =
            schoolId === userId && ownedDirect
              ? ownedDirect
              : await getById<School>(COLLECTIONS.schools, schoolId);
          if (school) {
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
            const row = {
              ...school,
              membership,
              memberRole: profile?.role ?? "institution",
              studentCode: profile?.student_code ?? null,
            };
            writeCachedSchool(userId!, row);
            return row;
          }
        }
      } catch (error) {
        console.error("[my-school] client load failed:", error);
      }
      return readCachedSchool<MySchoolRow>(userId!);
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
      try {
        const raw = await requestTeacherSchoolJoin({ data: { schoolCode } });
        const joined = unwrapTeacherJoin(raw);
        if (joined) return { ok: true as const, ...joined };
      } catch (error) {
        console.error("[teacher-join] server join failed:", error);
      }
      const school = await lookupSchool(schoolCode);
      if (!school?.id) {
        throw new Error("That School ID isn't on Memskool yet. Check it with your school.");
      }
      const uid = getFirebaseAuth().currentUser?.uid;
      if (!uid) throw new Error("Sign in to apply to a school.");
      const now = new Date().toISOString();
      try {
        await setById(COLLECTIONS.schoolMembers, uid, {
          school_id: school.id,
          user_id: uid,
          role: "teacher",
          status: "pending",
          student_code: null,
          created_at: now,
          updated_at: now,
        });
      } catch (error) {
        throw classifyFirebase(error);
      }
      try {
        await patchById(COLLECTIONS.users, uid, {
          school_id: school.id,
          membership_status: "pending",
          updated_at: now,
        });
      } catch (error) {
        console.error("[teacher-join] profile update failed:", error);
      }
      return { ok: true as const, schoolId: school.id, schoolName: school.name };
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

type SchoolMemberRow = {
  id: string;
  role: AppRole;
  status: MemberStatus;
  student_code: string | null;
  created_at: string;
  user_id: string;
  user: { id: string; full_name: string; email: string | null } | null;
};

function unwrapMemberRows(raw: unknown): SchoolMemberRow[] {
  if (Array.isArray(raw)) return raw as SchoolMemberRow[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "result", "payload", "value"]) {
      const inner = unwrapMemberRows(obj[key]);
      if (inner.length) return inner;
    }
  }
  return [];
}

export function useSchoolMembers(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-members", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const byId = new Map<string, SchoolMemberRow>();
      try {
        for (const row of unwrapMemberRows(await listSchoolMembers())) {
          if (row.id) byId.set(row.id, row);
        }
      } catch (error) {
        console.error("[school-members] server list failed:", error);
      }
      try {
        const members = await findMany<{
          role: AppRole;
          status: MemberStatus;
          student_code: string | null;
          created_at: string;
          user_id?: string;
        }>(COLLECTIONS.schoolMembers, [where("school_id", "==", schoolId!)]);
        for (const member of members) {
          if (byId.has(member.id)) continue;
          const userId = member.user_id || member.id;
          const user = await getById<{ full_name: string; email: string | null }>(
            COLLECTIONS.users,
            userId,
          ).catch(() => null);
          byId.set(member.id, {
            ...member,
            user_id: userId,
            user: user ? { id: user.id, full_name: user.full_name, email: user.email } : null,
          });
        }
      } catch (error) {
        console.error("[school-members] client list failed:", error);
      }
      return [...byId.values()].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      );
    },
  });
}

function unwrapOkStatus(raw: unknown): { ok: boolean; status: string | null } {
  let current: unknown = raw;
  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;
    const obj = current as Record<string, unknown>;
    if (obj["ok"] === true && typeof obj["status"] === "string") {
      return { ok: true, status: obj["status"] };
    }
    current = obj["data"] ?? obj["result"] ?? obj["payload"] ?? obj["value"];
  }
  return { ok: false, status: null };
}

export function useSetMemberStatus(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MemberStatus }) => {
      let reviewed = unwrapOkStatus(
        await setSchoolMemberStatus({ data: { memberId: id, status } }).catch((error) => {
          console.error("[members] server status failed:", error);
          return null;
        }),
      );
      if (!reviewed.ok || reviewed.status !== status) {
        const now = new Date().toISOString();
        const member = await getById<{
          school_id: string;
          user_id: string;
          role?: string;
        }>(COLLECTIONS.schoolMembers, id);
        if (!member) throw new Error("That membership was not found.");
        await patchById(COLLECTIONS.schoolMembers, id, { status, updated_at: now });
        const saved = await getById<{ status?: string }>(COLLECTIONS.schoolMembers, id);
        if (saved?.status !== status) throw new Error("Membership was not saved. Try again.");
        try {
          await patchById(COLLECTIONS.users, member.user_id, {
            school_id: status === "rejected" ? null : member.school_id,
            membership_status: status === "rejected" ? "approved" : status,
            updated_at: now,
          });
        } catch (error) {
          console.error("[members] profile update failed:", error);
        }
        try {
          await createDoc(COLLECTIONS.notifications, {
            user_id: member.user_id,
            title: status === "approved" ? "School access approved" : "School access update",
            body:
              status === "approved"
                ? "Your school has approved your account. School tools are now available."
                : status === "rejected"
                  ? "Your school request was not approved. Contact your administrator."
                  : "Your school membership is pending review.",
            kind: "security",
            link: "/dashboard",
            read: false,
            school_id: member.school_id,
            created_at: now,
          });
        } catch (error) {
          console.error("[members] notify failed:", error);
        }
        reviewed = { ok: true, status };
      }
      if (!reviewed.ok) throw new Error("Membership was not saved. Try again.");
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
