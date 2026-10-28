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
}): Promise<{ schoolId: string; schoolName: string | null }> {
  const wanted = schoolCodeKey(input.schoolCode);
  if (wanted.length < 3) {
    throw new Error("Enter a valid School ID.");
  }

  const profile = await input.db.collection("users").doc(input.userId).get();
  const role = profile.exists ? String(profile.get("role") ?? "") : "";
  if (role && role !== "teacher") {
    throw new Error("Only teacher accounts can apply to join a school as staff.");
  }

  const membership = profile.exists ? String(profile.get("membership_status") ?? "") : "";
  const existingSchoolId = profile.exists ? (profile.get("school_id") as string | null) : null;
  if (membership === "pending" && existingSchoolId) {
    throw new Error("Your school request is already waiting for approval.");
  }
  if (membership === "approved" && existingSchoolId) {
    throw new Error("You are already linked to a school.");
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

  await input.db.collection("school_members").doc(input.userId).set({
    school_id: schoolId,
    user_id: input.userId,
    role: "teacher",
    status: "pending",
    student_code: null,
    created_at: input.now,
    updated_at: input.now,
  });

  await adminSet(COLLECTIONS.users, input.userId, {
    school_id: schoolId,
    membership_status: "pending",
    updated_at: input.now,
  });

  await adminAuth().setCustomUserClaims(input.userId, {
    role: "teacher",
    schoolId,
    approved: false,
  });
  await rememberUserDirectory(input.email, input.userId, { role: "teacher", schoolId });

  return { schoolId, schoolName };
}
