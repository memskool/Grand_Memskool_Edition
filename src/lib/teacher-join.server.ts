import "@tanstack/react-start/server-only";
import type { Firestore } from "firebase-admin/firestore";
import { schoolCodeKey } from "@/lib/school-ids";
import { adminAuth } from "@/lib/firebase/admin.server";
import { adminSet } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { rememberUserDirectory } from "@/features/auth/services/session-account.server";

export async function applyTeacherToSchool(input: {
  db: Firestore;
  userId: string;
  email: string | null;
  schoolCode: string;
  now: string;
  /** Claims role when the users profile is still missing. */
  claimsRole?: string | null;
}): Promise<{ schoolId: string; schoolName: string | null; alreadyLinked?: boolean }> {
  const wanted = schoolCodeKey(input.schoolCode);
  if (wanted.length < 3) {
    throw new Error("Enter a valid School ID.");
  }

  const profile = await input.db.collection("users").doc(input.userId).get();
  const member = await input.db.collection("school_members").doc(input.userId).get();
  const profileRole = profile.exists ? String(profile.get("role") ?? "") : "";
  const memberRole = member.exists ? String(member.get("role") ?? "") : "";
  const role = profileRole || memberRole || String(input.claimsRole ?? "");
  if (role && role !== "teacher") {
    throw new Error("Only teacher accounts can apply to join a school as staff.");
  }

  const dir = await input.db.collection("school_directory").doc(wanted).get();
  if (!dir.exists) {
    throw new Error("That School ID isn't on Memskool yet. Check it with your school.");
  }
  const schoolId = String(dir.get("school_id") ?? "");
  if (!schoolId) {
    throw new Error("That School ID isn't on Memskool yet. Check it with your school.");
  }
  const school = await input.db.collection("schools").doc(schoolId).get();
  const schoolName = school.exists ? String(school.get("name") ?? "") || null : null;

  const existingMemberSchool = member.exists ? String(member.get("school_id") ?? "") : "";
  const existingMemberStatus = member.exists ? String(member.get("status") ?? "") : "";
  if (
    existingMemberSchool &&
    existingMemberSchool === schoolId &&
    (existingMemberStatus === "pending" || existingMemberStatus === "approved")
  ) {
    await ensureTeacherProfile({
      db: input.db,
      userId: input.userId,
      email: input.email,
      schoolId,
      status: existingMemberStatus === "approved" ? "approved" : "pending",
      now: input.now,
      keepCreatedAt:
        typeof member.get("created_at") === "string" ? String(member.get("created_at")) : input.now,
    });
    return { schoolId, schoolName, alreadyLinked: true };
  }

  const membership = profile.exists ? String(profile.get("membership_status") ?? "") : "";
  const existingSchoolId = profile.exists ? (profile.get("school_id") as string | null) : null;
  if (membership === "pending" && existingSchoolId && existingSchoolId !== schoolId) {
    throw new Error("Your school request is already waiting for approval.");
  }
  if (membership === "approved" && existingSchoolId && existingSchoolId !== schoolId) {
    throw new Error("You are already linked to a school.");
  }
  if (
    existingMemberSchool &&
    existingMemberSchool !== schoolId &&
    (existingMemberStatus === "pending" || existingMemberStatus === "approved")
  ) {
    throw new Error("You are already linked to a school.");
  }

  await input.db
    .collection("school_members")
    .doc(input.userId)
    .set(
      {
        school_id: schoolId,
        user_id: input.userId,
        role: "teacher",
        status: "pending",
        student_code: null,
        created_at:
          member.exists && typeof member.get("created_at") === "string"
            ? member.get("created_at")
            : input.now,
        updated_at: input.now,
      },
      { merge: true },
    );

  await ensureTeacherProfile({
    db: input.db,
    userId: input.userId,
    email: input.email,
    schoolId,
    status: "pending",
    now: input.now,
    keepCreatedAt:
      profile.exists && typeof profile.get("created_at") === "string"
        ? String(profile.get("created_at"))
        : input.now,
  });

  return { schoolId, schoolName };
}

async function ensureTeacherProfile(input: {
  db: Firestore;
  userId: string;
  email: string | null;
  schoolId: string;
  status: "pending" | "approved";
  now: string;
  keepCreatedAt: string;
}) {
  const authUser = await adminAuth()
    .getUser(input.userId)
    .catch(() => null);
  const existing = await input.db.collection("users").doc(input.userId).get();
  const fullName =
    (existing.exists && String(existing.get("full_name") ?? "").trim()) ||
    authUser?.displayName?.trim() ||
    (input.email ? input.email.split("@")[0] : null) ||
    "Teacher";

  await adminSet(COLLECTIONS.users, input.userId, {
    full_name: fullName,
    email: input.email ?? authUser?.email ?? null,
    avatar_url: existing.exists
      ? ((existing.get("avatar_url") as string | null) ?? authUser?.photoURL ?? null)
      : (authUser?.photoURL ?? null),
    phone: existing.exists ? ((existing.get("phone") as string | null) ?? null) : null,
    school_id: input.schoolId,
    student_code: existing.exists
      ? ((existing.get("student_code") as string | null) ?? null)
      : null,
    role: "teacher",
    membership_status: input.status,
    created_at: input.keepCreatedAt,
    updated_at: input.now,
  });

  // Phase 2: pending join keeps schoolId out of claims so tenantRead/sameSchool stay locked.
  await adminAuth().setCustomUserClaims(input.userId, {
    role: "teacher",
    schoolId: input.status === "approved" ? input.schoolId : null,
    approved: input.status === "approved",
  });
  await rememberUserDirectory(input.email, input.userId, {
    role: "teacher",
    schoolId: input.status === "approved" ? input.schoolId : null,
  });
}
