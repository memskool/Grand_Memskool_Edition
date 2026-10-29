import "@tanstack/react-start/server-only";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import {
  adminGetById,
  adminListAll,
  adminSet,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { adminAuth } from "@/lib/firebase/admin.server";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { toClientJson } from "@/lib/firebase/plain-data";
import { isSchoolManager, type AppRole } from "@/types/roles";
import { managedSchoolIdFor } from "@/lib/firebase/school-context.server";

export type ApplicationStatus = "pending" | "under_review" | "approved" | "rejected";

type ApplicationRow = {
  id: string;
  school_id: string;
  student_id: string;
  applicant_name: string;
  email: string | null;
  phone: string | null;
  class_level: string | null;
  intended_program: string | null;
  personal_statement: string | null;
  documents: Array<{ name: string; path: string | null; url: string | null }>;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

async function assertCanManageSchool(context: AuthedContext): Promise<void> {
  if (isSchoolManager(context.role)) return;
  const profile = await adminGetById<{ role?: AppRole }>(COLLECTIONS.users, context.userId);
  if (isSchoolManager(profile?.role)) return;
  throw new Error("You do not have permission to perform this action.");
}

async function loadApplicationsForSchool(schoolId: string): Promise<ApplicationRow[]> {
  try {
    const rows = await adminWhere<ApplicationRow>(
      COLLECTIONS.schoolApplications,
      "school_id",
      "==",
      schoolId,
    );
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    const all = await adminListAll<ApplicationRow>(COLLECTIONS.schoolApplications, 200);
    return all
      .filter((row) => row.school_id === schoolId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

export async function listSchoolApplicationsHandler(context: AuthedContext) {
  await assertCanManageSchool(context);
  const schoolId = await managedSchoolIdFor(context);
  const rows = await loadApplicationsForSchool(schoolId);
  const school = await adminGetById<{ name: string; category: string; city: string | null }>(
    COLLECTIONS.schools,
    schoolId,
  );
  return toClientJson(
    rows.map((row) => ({
      ...row,
      school: school
        ? { name: school.name, category: school.category, city: school.city ?? null }
        : null,
    })),
  );
}

export async function reviewSchoolApplicationHandler(
  data: { applicationId: string; status: ApplicationStatus; notes?: string | null },
  context: AuthedContext,
) {
  await assertCanManageSchool(context);
  const application = await adminGetById<ApplicationRow>(
    COLLECTIONS.schoolApplications,
    data.applicationId,
  );
  if (!application) throw new Error("That application was not found.");
  const schoolId = await managedSchoolIdFor(context);
  if (context.role !== "superadmin" && application.school_id !== schoolId) {
    throw new Error("You do not have permission to perform this action.");
  }

  const now = new Date().toISOString();
  await adminUpdate(COLLECTIONS.schoolApplications, application.id, {
    status: data.status,
    review_notes: data.notes ?? null,
    reviewed_at: now,
  });
  const saved = await adminGetById<ApplicationRow>(COLLECTIONS.schoolApplications, application.id);
  if (saved?.status !== data.status) {
    throw new Error("Application was not saved. Try again.");
  }

  const school = await adminGetById<{ name?: string }>(COLLECTIONS.schools, application.school_id);
  const schoolName = school?.name ?? "your school";

  if (data.status === "approved") {
    const studentId = application.student_id;
    await adminSet(COLLECTIONS.users, studentId, {
      school_id: application.school_id,
      membership_status: "approved",
      updated_at: now,
    });
    await adminSet(COLLECTIONS.schoolMembers, studentId, {
      school_id: application.school_id,
      user_id: studentId,
      role: "student",
      status: "approved",
      student_code: null,
      created_at: now,
      updated_at: now,
    });
    try {
      await adminAuth().setCustomUserClaims(studentId, {
        role: "student",
        schoolId: application.school_id,
        approved: true,
      });
    } catch (claimsError) {
      console.error("[reviewSchoolApplication] claims", claimsError);
    }
  }

  try {
    const { createAndQueueNotification, dispatchNotifications } =
      await import("./notifications.server");
    const statusCopy =
      data.status === "approved"
        ? `Congratulations — ${schoolName} approved your application.`
        : data.status === "rejected"
          ? `${schoolName} could not offer a place this time.`
          : data.status === "under_review"
            ? `${schoolName} is reviewing your application.`
            : `Your application to ${schoolName} is pending review.`;

    await createAndQueueNotification({
      userId: application.student_id,
      title: "Admission application update",
      body: data.notes?.trim() ? `${statusCopy} Note: ${data.notes.trim()}` : statusCopy,
      kind: "application",
      link: "/dream-school",
      schoolId: application.school_id,
      createdAt: now,
    });
    void dispatchNotifications();
  } catch (notifyError) {
    console.error("[reviewSchoolApplication] notify", notifyError);
  }

  return toClientJson({ ok: true as const, status: data.status, applicationId: application.id });
}
