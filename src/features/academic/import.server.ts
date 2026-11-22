import "@tanstack/react-start/server-only";
import { randomInt } from "node:crypto";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import { adminGetById, adminSet, adminWhere } from "@/lib/firebase/admin-repo";
import { adminAuth } from "@/lib/firebase/admin.server";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { requireSchoolManagerContext } from "@/lib/firebase/school-context.server";
import { parentLinkId } from "@/lib/parent-link";
import { classEnrollmentId } from "./ids";
import type { ImportRole, ImportRow } from "./report-policy";

/** Students without email sign in with a generated address on our own domain. */
export const PUPIL_EMAIL_DOMAIN = "pupil.memskool.com";
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/O/1/l/i
const CONCURRENCY = 5;

export type ImportResult = {
  line: number;
  full_name: string;
  status: "created" | "added" | "already" | "skipped";
  message: string;
  /** Only for new students without email: show once, print on a slip. */
  sign_in?: string;
  temp_password?: string;
  invited?: boolean;
  enrolled_in?: string | null;
};

function readable(length: number) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "school"
  );
}

async function findUserByEmail(email: string) {
  try {
    return await adminAuth().getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") return null;
    throw error;
  }
}

async function sendInvite(input: {
  email: string;
  name: string;
  schoolName: string;
  role: string;
}) {
  const { emailConfig, sendResendEmail } = await import("@/lib/mail.server");
  if (!emailConfig()) return false;
  const { appOrigin } = await import("@/lib/notifications.server");
  try {
    const link = await adminAuth().generatePasswordResetLink(input.email, {
      url: `${appOrigin()}/auth`,
    });
    const safe = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    await sendResendEmail(input.email, {
      subject: `${input.schoolName} added you to Memskool`,
      html: `<p>Hello ${safe(input.name)},</p><p>${safe(input.schoolName)} has added you to Memskool as a ${safe(input.role)}.</p><p><a href="${safe(link)}">Set your password</a> to sign in. The link expires after a while; if it does, use “Forgot password” on the sign-in page with this email.</p>`,
      text: `Hello ${input.name},\n\n${input.schoolName} has added you to Memskool as a ${input.role}.\nSet your password: ${link}\n\nIf the link has expired, use "Forgot password" on the sign-in page with this email.`,
    });
    return true;
  } catch (error) {
    console.error(
      "[import] invite failed:",
      error instanceof Error ? error.message.slice(0, 160) : "unknown",
    );
    return false;
  }
}

/**
 * School manager imports up to 50 people per call (the client sends a big list in
 * batches and shows progress). Every account is created server-side, approved, given
 * school claims, put on the roll, and — for students — enrolled in a matching class.
 */
export async function bulkImportPeopleHandler({
  data,
  context,
}: {
  data: { role: ImportRole; rows: ImportRow[] };
  context: AuthedContext;
}): Promise<{ results: ImportResult[] }> {
  const schoolId = await requireSchoolManagerContext(context);
  const school = await adminGetById<{ name?: string; code?: string }>(
    COLLECTIONS.schools,
    schoolId,
  );
  const schoolName = school?.name ?? "Your school";
  const classes = await adminWhere<{
    name?: string;
    status?: string;
    academic_year_id?: string | null;
    academic_period_id?: string | null;
  }>(COLLECTIONS.classes, "school_id", "==", schoolId);
  const classByName = new Map(
    classes
      .filter((c) => c.status !== "archived" && c.name)
      .map((c) => [c.name!.trim().toLowerCase(), c]),
  );
  const claimRole = data.role; // student | teacher | parent map 1:1 to claims
  const now = new Date().toISOString();

  const putOnRoll = async (uid: string, row: ImportRow, email: string) => {
    await adminAuth().setCustomUserClaims(uid, { role: claimRole, schoolId, approved: true });
    await adminSet(COLLECTIONS.users, uid, {
      full_name: row.full_name,
      email,
      role: data.role,
      school_id: schoolId,
      membership_status: "approved",
      updated_at: now,
    });
    const profile = await adminGetById<{ created_at?: string }>(COLLECTIONS.users, uid);
    if (!profile?.created_at) await adminSet(COLLECTIONS.users, uid, { created_at: now });
    await adminSet(COLLECTIONS.schoolMembers, uid, {
      school_id: schoolId,
      user_id: uid,
      role: data.role,
      status: "approved",
      student_code: null,
      created_at: now,
      source: "bulk_import",
    });
  };

  const enrol = async (uid: string, className: string | null) => {
    if (data.role !== "student" || !className) return null;
    const cls = classByName.get(className.trim().toLowerCase());
    if (!cls) return `no class named "${className}"`;
    const id = classEnrollmentId(cls.id, uid);
    const existing = await adminGetById<{ status?: string }>(COLLECTIONS.classEnrollments, id);
    if (existing && existing.status !== "ended") return cls.name ?? className;
    await adminSet(COLLECTIONS.classEnrollments, id, {
      school_id: schoolId,
      class_id: cls.id,
      student_id: uid,
      academic_year_id: cls.academic_year_id ?? null,
      academic_period_id: cls.academic_period_id ?? null,
      status: "active",
      started_at: now,
      ended_at: null,
    });
    return cls.name ?? className;
  };

  const linkChild = async (parentUid: string, child: string | null): Promise<string | null> => {
    if (data.role !== "parent" || !child) return null;
    const childUser = await findUserByEmail(child);
    if (!childUser) return `could not find a student with "${child}"`;
    const profile = await adminGetById<{ role?: string; school_id?: string | null }>(
      COLLECTIONS.users,
      childUser.uid,
    );
    if (profile?.role !== "student" || profile.school_id !== schoolId) {
      return `"${child}" is not a student in your school`;
    }
    await adminSet(
      COLLECTIONS.parentStudents,
      parentLinkId(parentUid, childUser.uid),
      { parent_id: parentUid, student_id: childUser.uid, school_id: schoolId, created_at: now },
      false,
    );
    return null;
  };

  const importOne = async (row: ImportRow): Promise<ImportResult> => {
    const base = { line: row.line, full_name: row.full_name };
    try {
      // 1. Existing account with this email.
      if (row.email) {
        const existing = await findUserByEmail(row.email);
        if (existing) {
          const profile = await adminGetById<{ role?: string; school_id?: string | null }>(
            COLLECTIONS.users,
            existing.uid,
          );
          if (profile?.school_id && profile.school_id !== schoolId) {
            return { ...base, status: "skipped", message: "Already belongs to another school." };
          }
          if (profile?.role && profile.role !== data.role) {
            return {
              ...base,
              status: "skipped",
              message: `This email is a ${profile.role} account, not a ${data.role}.`,
            };
          }
          // Someone else's existing account is never pulled into a school without their
          // consent: they apply (or accept) themselves, then the admin approves.
          if (profile?.school_id !== schoolId) {
            return {
              ...base,
              status: "skipped",
              message:
                "This person already has a Memskool account. Ask them to apply to your school from Dream School, then approve them under Admissions.",
            };
          }
          const enrolled = await enrol(existing.uid, row.class_name);
          const linkProblem = await linkChild(existing.uid, row.child);
          const notes = [
            enrolled && enrolled.startsWith("no class") ? enrolled : null,
            linkProblem,
          ].filter(Boolean);
          return {
            ...base,
            status: "already",
            message:
              "Already in your school." + (notes.length ? ` Note: ${notes.join("; ")}.` : ""),
            enrolled_in: enrolled && !enrolled.startsWith("no class") ? enrolled : null,
          };
        }
      }

      // 2. New account.
      let email = row.email;
      let tempPassword: string | undefined;
      if (!email) {
        // Students without email: generated sign-in on our own domain + one-time password.
        email = `${slug(school?.code ?? schoolName)}-${readable(5)}@${PUPIL_EMAIL_DOMAIN}`;
        tempPassword = `${readable(4)}-${readable(4)}`;
      }
      const created = await adminAuth().createUser({
        email,
        displayName: row.full_name,
        ...(tempPassword ? { password: tempPassword } : {}),
      });
      await putOnRoll(created.uid, row, email);
      const enrolled = await enrol(created.uid, row.class_name);
      const linkProblem = await linkChild(created.uid, row.child);
      const invited = row.email
        ? await sendInvite({ email, name: row.full_name, schoolName, role: data.role })
        : false;
      const notes = [enrolled && enrolled.startsWith("no class") ? enrolled : null, linkProblem]
        .filter(Boolean)
        .join("; ");
      return {
        ...base,
        status: "created",
        message: row.email
          ? invited
            ? "Account created. A set-password email was sent."
            : 'Account created. Email is not set up, so ask them to use "Forgot password" with this email.'
          : "Account created. Give them the sign-in and temporary password below.",
        ...(tempPassword ? { sign_in: email, temp_password: tempPassword } : {}),
        invited,
        enrolled_in: enrolled && !enrolled.startsWith("no class") ? enrolled : null,
        ...(notes ? { message: `Account created. Note: ${notes}.` } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        ...base,
        status: "skipped",
        message: message.includes("email-already-exists")
          ? "That email is already registered."
          : `Could not import: ${message.slice(0, 140)}`,
      };
    }
  };

  const results: ImportResult[] = [];
  for (let i = 0; i < data.rows.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(data.rows.slice(i, i + CONCURRENCY).map(importOne))));
  }
  return { results };
}
