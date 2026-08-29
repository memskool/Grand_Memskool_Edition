import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireFirebaseAuth, type AuthedContext } from "@/lib/firebase/require-auth";
import type { AppRole } from "@/types/roles";
import { rosterLookupId, schoolCodeKey } from "@/lib/school-ids";
import { looksLikeHtmlError } from "@/lib/errors/app-error";
import { adminSet } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { plainFirestoreData } from "@/lib/firebase/plain-data";
import { rememberSchoolInCatalog } from "@/lib/school-catalog.server";
import { rememberUserDirectory } from "@/features/auth/services/session-account.server";

const SignupSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["student", "teacher", "parent", "institution"]),
  school_code: z.string().trim().max(24).nullable(),
  student_code: z.string().trim().max(40).nullable(),
  school_name: z.string().trim().max(160).nullable(),
});

type SignupInput = z.infer<typeof SignupSchema>;

function codeKey(code: string): string {
  return schoolCodeKey(code);
}

function publicSignupError(error: unknown): Error {
  if (error instanceof Error) {
    const first = error.message.split(/\r?\n/)[0]?.trim() ?? "";
    if (
      first &&
      first.length <= 180 &&
      !looksLikeHtmlError(first) &&
      !first.toLowerCase().includes("firebase") &&
      !first.toLowerCase().includes("firestore") &&
      !first.includes("http") &&
      !first.includes("at ")
    ) {
      return new Error(first);
    }
  }
  const raw = error instanceof Error ? error.message : String(error);
  const m = raw.toLowerCase();
  if (
    m.includes("could not load the default credentials") ||
    m.includes("unable to detect a project id") ||
    m.includes("failed to parse private key") ||
    m.includes("invalid_grant") ||
    m.includes("credential")
  ) {
    return new Error(
      "Memskool could not finish signup because the live server is missing Firebase admin credentials.",
    );
  }
  if (
    m.includes("runquery") ||
    m.includes("executepipeline") ||
    m.includes("explain options") ||
    m.includes("failed_precondition")
  ) {
    return new Error("Could not look up that school right now. Try again in a moment.");
  }
  return new Error("Could not finish creating this account. Please try again.");
}

async function allocateSignupCode(db: Firestore): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = `MS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const existing = await db.collection("school_directory").doc(candidate).get();
    if (!existing.exists) return candidate;
  }
  throw new Error("Could not allocate a School ID. Try again.");
}

async function provisionInstitutionSchool(
  uid: string,
  email: string | null,
  schoolName: string | null,
  code: string,
  now: string,
): Promise<string> {
  await adminSet(COLLECTIONS.schools, uid, {
    name: schoolName,
    code,
    category: "secondary",
    city: null,
    country: null,
    website: null,
    description: null,
    logo_url: null,
    fees_currency: "UGX",
    badges: [],
    is_international: false,
    contact_email: email,
    admissions_open: true,
    owner_id: uid,
    created_by: uid,
    created_at: now,
    updated_at: now,
  });
  await adminSet(COLLECTIONS.schoolDirectory, code, {
    school_id: uid,
    name: schoolName,
    city: null,
    country: null,
    category: "secondary",
    admissions_open: true,
  });
  await adminSet(COLLECTIONS.schoolMembers, uid, {
    school_id: uid,
    user_id: uid,
    role: "institution",
    status: "approved",
    created_at: now,
  });
  await rememberSchoolInCatalog(uid, code);
  return uid;
}

async function completeSignupHandler(data: SignupInput, context: AuthedContext) {
  const { adminAuth, adminDb } = await import("@/lib/firebase/admin.server");
  const db = adminDb();
  const uid = context.userId;
  const email = context.email;

  // Students create a free account first; school / student IDs are optional later.
  if (data.role === "teacher" && !data.school_code?.trim()) {
    throw new Error("Enter your School ID.");
  }
  if (data.role === "institution" && !data.school_name?.trim()) {
    throw new Error("Enter your school's name.");
  }

  const now = new Date().toISOString();
  let schoolId: string | null = null;
  let membership: "owner" | "pending" | "approved" = "approved";
  const storedRole: AppRole = data.role === "institution" ? "institution" : data.role;

  const existingProfile = await db.collection("users").doc(uid).get();
  const existingSchoolId =
    existingProfile.exists && typeof existingProfile.get("school_id") === "string"
      ? String(existingProfile.get("school_id"))
      : null;
  const existingRole = existingProfile.exists
    ? (existingProfile.get("role") as string | undefined)
    : undefined;

  if (data.role === "institution") {
    const ownedDoc = await db.collection("schools").doc(uid).get();
    if (ownedDoc.exists) {
      schoolId = uid;
      membership = "owner";
      await rememberSchoolInCatalog(
        schoolId,
        ownedDoc.get("code") ? String(ownedDoc.get("code")) : null,
      );
    } else if (existingSchoolId && (existingRole === "institution" || existingRole === "admin")) {
      const existingSchool = await db.collection("schools").doc(existingSchoolId).get();
      const ownsExisting =
        existingSchool.exists &&
        (String(existingSchool.get("owner_id") ?? "") === uid || existingSchoolId === uid);
      if (ownsExisting) {
        schoolId = existingSchoolId;
        membership = "owner";
        await rememberSchoolInCatalog(
          schoolId,
          existingSchool.get("code") ? String(existingSchool.get("code")) : null,
        );
      } else {
        const wanted = data.school_code ? codeKey(data.school_code) : await allocateSignupCode(db);
        const dir = await db.collection("school_directory").doc(wanted).get();
        if (dir.exists && String(dir.get("school_id") ?? "") !== uid) {
          throw new Error("That School ID is already taken. Pick another one.");
        }
        schoolId = await provisionInstitutionSchool(uid, email, data.school_name, wanted, now);
        membership = "owner";
      }
    } else {
      const wanted = data.school_code ? codeKey(data.school_code) : await allocateSignupCode(db);
      const dir = await db.collection("school_directory").doc(wanted).get();
      if (dir.exists) {
        const dirSchoolId = String(dir.get("school_id") ?? "");
        const school = dirSchoolId ? await db.collection("schools").doc(dirSchoolId).get() : null;
        if (school?.exists && school.get("owner_id") === uid) {
          schoolId = school.id;
          await rememberSchoolInCatalog(schoolId, wanted);
        } else {
          throw new Error("That School ID is already taken. Pick another one.");
        }
      } else {
        schoolId = await provisionInstitutionSchool(uid, email, data.school_name, wanted, now);
      }
      membership = "owner";
    }
  } else if (data.role === "teacher" && data.school_code) {
    const wanted = codeKey(data.school_code);
    const dir = await db.collection("school_directory").doc(wanted).get();
    if (!dir.exists) {
      throw new Error("That School ID isn't on Memskool yet. Check it with your school.");
    }
    schoolId = String(dir.get("school_id"));
    membership = "pending";

    const memberSnap = await db.collection("school_members").doc(uid).get();
    if (!memberSnap.exists) {
      await db.collection("school_members").doc(uid).set({
        school_id: schoolId,
        user_id: uid,
        role: storedRole,
        status: "pending",
        student_code: null,
        created_at: now,
      });
    }
  } else if (data.role === "student" && data.school_code && data.student_code?.trim()) {
    // Optional legacy join path if both IDs are supplied (not required at signup).
    const wanted = codeKey(data.school_code);
    const dir = await db.collection("school_directory").doc(wanted).get();
    if (!dir.exists) {
      throw new Error("That School ID isn't on Memskool yet. Check it with your school.");
    }
    schoolId = String(dir.get("school_id"));
    const rosterId = rosterLookupId(schoolId, data.student_code);
    const roster = await db.collection("school_roster").doc(rosterId).get();
    if (!roster.exists) {
      throw new Error("That student ID is not on this school's roster yet.");
    }
    if (roster.get("claimed_by") && roster.get("claimed_by") !== uid) {
      throw new Error("That student ID is already linked to another account.");
    }
    await roster.ref.update({ claimed_by: uid });
    membership = "approved";
    const memberSnap = await db.collection("school_members").doc(uid).get();
    if (!memberSnap.exists) {
      await db.collection("school_members").doc(uid).set({
        school_id: schoolId,
        user_id: uid,
        role: storedRole,
        status: "approved",
        student_code: data.student_code,
        created_at: now,
      });
    }
  }

  const claimRole = storedRole === "institution" ? "admin" : storedRole;
  await adminAuth().setCustomUserClaims(uid, {
    role: claimRole,
    schoolId,
    approved: membership !== "pending",
  });

  await adminSet(
    COLLECTIONS.users,
    uid,
    plainFirestoreData({
      full_name: data.full_name,
      email,
      avatar_url: existingProfile.exists ? (existingProfile.get("avatar_url") ?? null) : null,
      phone: existingProfile.exists ? (existingProfile.get("phone") ?? null) : null,
      school_id: schoolId,
      student_code: data.student_code,
      role: storedRole,
      membership_status: membership,
      created_at:
        existingProfile.exists && typeof existingProfile.get("created_at") === "string"
          ? existingProfile.get("created_at")
          : now,
      updated_at: now,
    }),
  );
  await rememberUserDirectory(email, uid, { role: storedRole, schoolId });

  try {
    await db.collection("audit_logs").add({
      type: "account_created",
      actor_id: uid,
      school_id: schoolId,
      target_id: uid,
      summary: `Signup as ${storedRole}`,
      created_at: now,
      created_at_server: FieldValue.serverTimestamp(),
    });
  } catch {
    // Audit must not block a finished signup.
  }

  return { schoolId, role: storedRole, membership };
}

export const completeSignup = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SignupSchema.parse(data))
  .handler(async ({ data, context }) => {
    try {
      return await completeSignupHandler(data, context);
    } catch (error) {
      console.error(error);
      throw publicSignupError(error);
    }
  });
