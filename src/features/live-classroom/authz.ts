import { isSchoolManager, type AppRole } from "@/types/roles";
import { adminGetById, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { LiveSessionStatus } from "./contracts";

export type ClassDoc = {
  school_id: string;
  teacher_id?: string | null;
  name?: string;
  status?: string;
};

export type SessionDoc = {
  school_id: string | null;
  class_id: string;
  host_id: string;
  lesson_id?: string | null;
  title?: string | null;
  status?: LiveSessionStatus | string;
  is_active?: boolean;
  provider_room?: string;
  started_at?: string;
  ended_at?: string | null;
  kind?: "school" | "gold" | string | null;
  gold_class_id?: string | null;
  gold_tutor_id?: string | null;
};

export function requireSchool(schoolId: string | null): string {
  if (!schoolId) throw new Error("You are not attached to a school.");
  return schoolId;
}

export async function loadClass(classId: string): Promise<ClassDoc & { id: string }> {
  const cls = await adminGetById<ClassDoc>(COLLECTIONS.classes, classId);
  if (!cls) throw new Error("That class was not found.");
  return cls;
}

export async function isAssignedTeacher(classId: string, userId: string): Promise<boolean> {
  const cls = await adminGetById<ClassDoc>(COLLECTIONS.classes, classId);
  if (cls?.teacher_id === userId) return true;
  const rows = await adminWhere<{ teacher_id: string; status?: string }>(
    COLLECTIONS.classTeacherAssignments,
    "class_id",
    "==",
    classId,
    [["teacher_id", "==", userId]],
  );
  return rows.some((row) => row.status !== "ended");
}

export async function hasActiveEnrollment(classId: string, studentId: string): Promise<boolean> {
  const rows = await adminWhere<{ student_id: string; status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    classId,
    [["student_id", "==", studentId]],
  );
  return rows.some((row) => row.status !== "ended");
}

export async function assertCanHostClass(
  role: AppRole,
  schoolId: string | null,
  userId: string,
  classId: string,
): Promise<ClassDoc & { id: string }> {
  const school = requireSchool(schoolId);
  if (role === "teacher") {
    // approved is already enforced by requireFirebaseAuth callers
  } else if (!isSchoolManager(role)) {
    throw new Error("Only teachers can start a live class.");
  }
  const cls = await loadClass(classId);
  if (cls.school_id !== school) throw new Error("That class is not in your school.");
  if (cls.status === "archived") throw new Error("That class is archived.");
  if (role === "teacher") {
    const assigned = await isAssignedTeacher(classId, userId);
    if (!assigned) throw new Error("You are not assigned to this class.");
  }
  return cls;
}

export async function assertCanManageSession(
  role: AppRole,
  schoolId: string | null,
  userId: string,
  session: SessionDoc & { id: string },
): Promise<void> {
  if (session.kind === "gold" || session.gold_class_id) {
    if (session.host_id === userId || role === "superadmin") return;
    throw new Error("You are not allowed to manage this class.");
  }
  const school = requireSchool(schoolId);
  if (session.school_id !== school) throw new Error("You are not allowed to manage this class.");
  if (session.host_id === userId) return;
  if (isSchoolManager(role)) return;
  if (role === "teacher" && (await isAssignedTeacher(session.class_id, userId))) return;
  throw new Error("You are not allowed to manage this class.");
}

export function sessionIsJoinable(session: SessionDoc): boolean {
  const status = session.status ?? (session.is_active ? "live" : "ended");
  return status === "live" && session.is_active !== false;
}

export async function assertCanJoinSession(
  role: AppRole,
  schoolId: string | null,
  userId: string,
  session: SessionDoc & { id: string },
): Promise<{ isHost: boolean; canPublish: boolean }> {
  if (session.kind === "gold" || session.gold_class_id) {
    const { assertGoldSessionJoin } = await import("@/features/gold/gold.server");
    return assertGoldSessionJoin(userId, session);
  }
  const school = requireSchool(schoolId);
  if (session.school_id !== school) throw new Error("You are not allowed to join this class.");
  if (!sessionIsJoinable(session)) {
    const status = session.status ?? (session.is_active ? "live" : "ended");
    if (status === "cancelled") throw new Error("This class was cancelled.");
    throw new Error("This session has ended.");
  }

  const isHost = session.host_id === userId;
  if (isHost) return { isHost: true, canPublish: true };

  if (isSchoolManager(role) || role === "teacher") {
    const assigned = role === "teacher" ? await isAssignedTeacher(session.class_id, userId) : true;
    if (!assigned) throw new Error("You are not allowed to join this class.");
    return { isHost: false, canPublish: true };
  }

  if (role !== "student") throw new Error("You are not allowed to join this class.");
  const enrolled = await hasActiveEnrollment(session.class_id, userId);
  if (!enrolled) throw new Error("You are not allowed to join this class.");
  return { isHost: false, canPublish: true };
}
