import "@tanstack/react-start/server-only";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import {
  adminDelete,
  adminGetById,
  adminSet,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { parentLinkId } from "@/lib/parent-link";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { toClientJson } from "@/lib/firebase/plain-data";
import { isSchoolManager, type AppRole, type MemberStatus } from "@/types/roles";
import { adminAuth } from "@/lib/firebase/admin.server";
import { managedSchoolIdFor } from "@/lib/firebase/school-context.server";

async function assertCanManageSchool(context: { userId: string; role: AppRole }): Promise<void> {
  // Phase 2: claims-derived role only — never trust users/{uid}.role for privilege.
  if (!isSchoolManager(context.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
}

export async function setSchoolMemberStatusHandler({
  data,
  context,
}: {
  data: { memberId: string; status: MemberStatus };
  context: AuthedContext;
}) {
  await assertCanManageSchool(context);
  const member = await adminGetById<{
    school_id: string;
    user_id: string;
    role: string;
  }>(COLLECTIONS.schoolMembers, data.memberId);
  if (!member) throw new Error("That membership was not found.");
  const schoolId = await managedSchoolIdFor(context);
  if (context.role !== "superadmin" && member.school_id !== schoolId) {
    throw new Error("You do not have permission to perform this action.");
  }

  const now = new Date().toISOString();
  await adminUpdate(COLLECTIONS.schoolMembers, member.id, { status: data.status });
  const saved = await adminGetById<{ status?: string }>(COLLECTIONS.schoolMembers, member.id);
  if (saved?.status !== data.status) {
    throw new Error("Membership was not saved. Try again.");
  }
  const independentAgain = data.status === "rejected";
  // Phase 2: rejection stays rejected on the profile (not silently "approved").
  await adminSet(COLLECTIONS.users, member.user_id, {
    school_id: independentAgain ? null : member.school_id,
    membership_status: data.status,
    updated_at: now,
  });

  const profile = await adminGetById<{ role?: string; school_id?: string | null }>(
    COLLECTIONS.users,
    member.user_id,
  );
  const storedRole = profile?.role ?? member.role;
  const claimRole = storedRole === "institution" ? "admin" : storedRole;
  try {
    await adminAuth().setCustomUserClaims(member.user_id, {
      role: claimRole,
      schoolId: independentAgain || data.status === "pending" ? null : member.school_id,
      // Rejected teachers are independent again (approved for Gold); pending stays locked.
      approved: data.status !== "pending",
    });
  } catch (claimsError) {
    console.error("[setSchoolMemberStatus] claims", claimsError);
  }

  try {
    const { createAndQueueNotification, dispatchNotifications } =
      await import("./notifications.server");
    await createAndQueueNotification({
      userId: member.user_id,
      title: data.status === "approved" ? "School access approved" : "School access update",
      body:
        data.status === "approved"
          ? "Your school has approved your teacher account. Teaching tools are now available."
          : data.status === "rejected"
            ? "Your school request was not approved. Contact your administrator."
            : "Your school membership is pending review.",
      kind: "security",
      link: "/dashboard",
      schoolId: member.school_id,
      createdAt: now,
    });
    void dispatchNotifications();
  } catch (notifyError) {
    console.error("[setSchoolMemberStatus] notify", notifyError);
  }

  return { ok: true as const, status: data.status };
}

type MemberRow = {
  id: string;
  school_id: string;
  user_id: string;
  role: string;
  status: string;
  student_code: string | null;
  created_at: string;
};

async function loadMembersForSchool(schoolId: string): Promise<MemberRow[]> {
  // Phase 4: trust the school_id query — no whole-collection scan fallback.
  const rows = await adminWhere<MemberRow>(COLLECTIONS.schoolMembers, "school_id", "==", schoolId);
  return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

/** School admin: list members with basic profile info. */
export async function listSchoolMembersHandler({ context }: { context: AuthedContext }) {
  await assertCanManageSchool(context);
  const schoolId = await managedSchoolIdFor(context);
  try {
    const { syncApprovedApplicantsToRoll } = await import("@/lib/applications.server");
    await syncApprovedApplicantsToRoll(schoolId);
  } catch (error) {
    console.error("[members] approved-applicant sync failed:", error);
  }
  const members = await loadMembersForSchool(schoolId);
  return toClientJson(
    await Promise.all(
      members.map(async (member) => {
        const userId = member.user_id || member.id;
        const user = await adminGetById<{ full_name: string; email: string | null }>(
          COLLECTIONS.users,
          userId,
        );
        return {
          ...member,
          user_id: userId,
          user: user ? { id: user.id, full_name: user.full_name, email: user.email ?? null } : null,
        };
      }),
    ),
  );
}

export async function remindSchoolApprovalHandler({
  data,
  context,
}: {
  data: { schoolId: string };
  context: AuthedContext;
}) {
  if (context.schoolId !== data.schoolId && context.role !== "superadmin") {
    throw new Error("You do not have permission to perform this action.");
  }
  const school = await adminGetById<{ owner_id?: string; name?: string }>(
    COLLECTIONS.schools,
    data.schoolId,
  );
  if (!school?.owner_id) throw new Error("That school has no administrator to notify.");
  const { createAndQueueNotification, dispatchNotifications } =
    await import("./notifications.server");
  await createAndQueueNotification({
    userId: school.owner_id,
    title: "Teacher waiting for approval",
    body: "A teacher has asked you to review their Memskool access request.",
    kind: "announcement",
    link: "/dashboard",
    schoolId: data.schoolId,
  });
  void dispatchNotifications();
  return { ok: true as const };
}

async function assertSchoolMember(
  userId: string,
  schoolId: string,
  expectedRole: "parent" | "student",
) {
  const profile = await adminGetById<{
    role?: string;
    school_id?: string | null;
    full_name?: string;
  }>(COLLECTIONS.users, userId);
  if (!profile) throw new Error("That account was not found.");
  if (profile.role !== expectedRole) {
    throw new Error(
      expectedRole === "parent"
        ? "Select a parent account, not a student or teacher."
        : "Select a student account, not a parent or teacher.",
    );
  }
  const memberships = await adminWhere<{ school_id: string; user_id: string; status?: string }>(
    COLLECTIONS.schoolMembers,
    "user_id",
    "==",
    userId,
    [["school_id", "==", schoolId]],
  );
  // Phase 8: existence-only membership is not enough — require approved/owner on the roll.
  const approved = memberships.some((row) => row.status === "approved" || row.status === "owner");
  if (!approved) {
    throw new Error("Both people must be approved members of your school.");
  }
  return profile;
}

export async function linkParentStudentHandler({
  data,
  context,
}: {
  data: { parentId: string; studentId: string };
  context: AuthedContext;
}) {
  if (!isSchoolManager(context.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  const schoolId = context.schoolId;
  if (!schoolId && context.role !== "superadmin") {
    throw new Error("Your account is not linked to a school.");
  }
  if (data.parentId === data.studentId) {
    throw new Error("A parent and a student must be two different accounts.");
  }
  const resolvedSchool = schoolId;
  if (!resolvedSchool) throw new Error("Your account is not linked to a school.");

  await assertSchoolMember(data.parentId, resolvedSchool, "parent");
  const student = await assertSchoolMember(data.studentId, resolvedSchool, "student");

  const now = new Date().toISOString();
  const id = parentLinkId(data.parentId, data.studentId);
  await adminSet(
    COLLECTIONS.parentStudents,
    id,
    {
      parent_id: data.parentId,
      student_id: data.studentId,
      school_id: resolvedSchool,
      created_at: now,
    },
    false,
  );

  const { createAndQueueNotification, dispatchNotifications } =
    await import("./notifications.server");
  await createAndQueueNotification({
    userId: data.parentId,
    title: "Child linked to your account",
    body: student.full_name
      ? `${student.full_name} is now linked so you can view permitted progress.`
      : "Your school linked a student account to yours.",
    kind: "announcement",
    link: "/dashboard",
    schoolId: resolvedSchool,
    createdAt: now,
  });
  void dispatchNotifications();

  return { ok: true as const, id };
}

export async function unlinkParentStudentHandler({
  data,
  context,
}: {
  data: { linkId: string };
  context: AuthedContext;
}) {
  if (!isSchoolManager(context.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  const link = await adminGetById<{ school_id?: string }>(COLLECTIONS.parentStudents, data.linkId);
  if (!link) throw new Error("That family link was not found.");
  if (context.role !== "superadmin" && link.school_id !== context.schoolId) {
    throw new Error("You do not have permission to perform this action.");
  }
  await adminDelete(COLLECTIONS.parentStudents, data.linkId);
  return { ok: true as const };
}

export async function requestTeacherSchoolJoinHandler({
  data,
  context,
}: {
  data: { schoolCode: string };
  context: AuthedContext;
}) {
  // Phase 2/3: claims role is authoritative for who may apply as teacher.
  if (context.role !== "teacher") {
    throw new Error("Only teacher accounts can apply to join a school as staff.");
  }
  const { adminDb } = await import("@/lib/firebase/admin.server");
  const { applyTeacherToSchool } = await import("@/lib/teacher-join.server");
  const now = new Date().toISOString();
  const joined = await applyTeacherToSchool({
    db: adminDb(),
    userId: context.userId,
    email: context.email,
    schoolCode: data.schoolCode,
    now,
    claimsRole: context.role,
  });

  const school = await adminGetById<{ owner_id?: string; name?: string }>(
    COLLECTIONS.schools,
    joined.schoolId,
  );
  if (school?.owner_id) {
    const { createAndQueueNotification, dispatchNotifications } =
      await import("./notifications.server");
    await createAndQueueNotification({
      userId: school.owner_id,
      title: "Teacher asked to join",
      body: "A teacher applied to join your school. Review the request in School Admin.",
      kind: "security",
      link: "/school-admin",
      schoolId: joined.schoolId,
      createdAt: now,
    });
    void dispatchNotifications();
  }

  return {
    ok: true as const,
    schoolId: joined.schoolId,
    schoolName: joined.schoolName,
  };
}
