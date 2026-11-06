import "@tanstack/react-start/server-only";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import { adminGetById, adminSet, adminUpdate, adminWhere } from "@/lib/firebase/admin-repo";
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
  /** Privileged reviewer uid — required before sync may admit to roll (Phase 1). */
  reviewed_by?: string | null;
  created_at: string;
};

async function assertCanManageSchool(context: AuthedContext): Promise<void> {
  if (isSchoolManager(context.role)) return;
  const profile = await adminGetById<{ role?: AppRole }>(COLLECTIONS.users, context.userId);
  if (isSchoolManager(profile?.role)) return;
  throw new Error("You do not have permission to perform this action.");
}

async function loadApplicationsForSchool(schoolId: string): Promise<ApplicationRow[]> {
  // Phase 4: trust the school_id query — no whole-collection scan fallback.
  const rows = await adminWhere<ApplicationRow>(
    COLLECTIONS.schoolApplications,
    "school_id",
    "==",
    schoolId,
  );
  return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

/** Write school_members + users + claims so approved applicants appear on the roll. */
export async function admitStudentFromApplication(
  application: Pick<
    ApplicationRow,
    "student_id" | "school_id" | "applicant_name" | "email" | "phone" | "created_at"
  >,
  now = new Date().toISOString(),
): Promise<void> {
  const studentId = application.student_id;
  if (!studentId || !application.school_id) {
    throw new Error("That application is missing student or school details.");
  }

  const existingUser = await adminGetById<{
    full_name?: string;
    email?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    student_code?: string | null;
    created_at?: string;
  }>(COLLECTIONS.users, studentId);
  const existingMember = await adminGetById<{ created_at?: string }>(
    COLLECTIONS.schoolMembers,
    studentId,
  );

  let authDisplay: string | null = null;
  let authEmail: string | null = null;
  let authPhoto: string | null = null;
  try {
    const authUser = await adminAuth().getUser(studentId);
    authDisplay = authUser.displayName ?? null;
    authEmail = authUser.email ?? null;
    authPhoto = authUser.photoURL ?? null;
  } catch {
    // Auth lookup is best-effort; application fields still fill the profile.
  }

  const fullName =
    existingUser?.full_name?.trim() ||
    application.applicant_name?.trim() ||
    authDisplay?.trim() ||
    application.email?.split("@")[0] ||
    "Student";

  await adminSet(COLLECTIONS.schoolMembers, studentId, {
    school_id: application.school_id,
    user_id: studentId,
    role: "student",
    status: "approved",
    student_code: existingUser?.student_code ?? null,
    created_at: existingMember?.created_at || application.created_at || now,
    updated_at: now,
  });

  await adminSet(COLLECTIONS.users, studentId, {
    full_name: fullName,
    email: existingUser?.email ?? application.email ?? authEmail ?? null,
    avatar_url: existingUser?.avatar_url ?? authPhoto ?? null,
    phone: existingUser?.phone ?? application.phone ?? null,
    school_id: application.school_id,
    student_code: existingUser?.student_code ?? null,
    role: "student",
    membership_status: "approved",
    created_at: existingUser?.created_at || application.created_at || now,
    updated_at: now,
  });

  const savedMember = await adminGetById<{ school_id?: string; status?: string; role?: string }>(
    COLLECTIONS.schoolMembers,
    studentId,
  );
  if (
    !savedMember ||
    savedMember.school_id !== application.school_id ||
    savedMember.status !== "approved" ||
    savedMember.role !== "student"
  ) {
    throw new Error("Student was approved but could not be added to the school roll.");
  }

  try {
    await adminAuth().setCustomUserClaims(studentId, {
      role: "student",
      schoolId: application.school_id,
      approved: true,
    });
  } catch (claimsError) {
    console.error("[admitStudentFromApplication] claims", claimsError);
  }
}

/**
 * Backfill school_members for applications already marked approved.
 * Phase 1: only apps stamped with reviewed_by + reviewed_at (privileged review) may admit.
 * Forged client-created status=approved rows without a reviewer are ignored.
 */
export async function syncApprovedApplicantsToRoll(schoolId: string): Promise<number> {
  const apps = await loadApplicationsForSchool(schoolId);
  let healed = 0;
  const now = new Date().toISOString();
  for (const app of apps) {
    if (app.status !== "approved" || !app.student_id) continue;
    if (
      typeof app.reviewed_by !== "string" ||
      !app.reviewed_by ||
      typeof app.reviewed_at !== "string" ||
      !app.reviewed_at
    ) {
      console.warn("[applications] skip approve sync — missing privileged review stamp:", app.id);
      continue;
    }
    const member = await adminGetById<{ school_id?: string; status?: string; role?: string }>(
      COLLECTIONS.schoolMembers,
      app.student_id,
    );
    if (
      member?.school_id === schoolId &&
      member.status === "approved" &&
      member.role === "student"
    ) {
      continue;
    }
    await admitStudentFromApplication(app, now);
    healed += 1;
  }
  return healed;
}

export async function listSchoolApplicationsHandler(context: AuthedContext) {
  await assertCanManageSchool(context);
  const schoolId = await managedSchoolIdFor(context);
  try {
    await syncApprovedApplicantsToRoll(schoolId);
  } catch (error) {
    console.error("[applications] approved-roll sync failed:", error);
  }
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
  data: {
    applicationId: string;
    status: ApplicationStatus;
    notes?: string | null | undefined;
  },
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
    reviewed_by: context.userId,
  });
  const saved = await adminGetById<ApplicationRow>(COLLECTIONS.schoolApplications, application.id);
  if (saved?.status !== data.status) {
    throw new Error("Application was not saved. Try again.");
  }

  const school = await adminGetById<{ name?: string }>(COLLECTIONS.schools, application.school_id);
  const schoolName = school?.name ?? "your school";

  if (data.status === "approved") {
    await admitStudentFromApplication(application, now);
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
