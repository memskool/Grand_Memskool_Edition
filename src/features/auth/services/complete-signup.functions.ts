import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import type { AppRole } from "@/types/roles";

const SignupSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["student", "teacher", "parent", "institution"]),
  school_code: z.string().trim().max(24).nullable(),
  student_code: z.string().trim().max(40).nullable(),
  school_name: z.string().trim().max(160).nullable(),
});

function codeKey(code: string): string {
  return code.trim().toUpperCase();
}

async function allocateSignupCode(db: Firestore): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = `MS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const existing = await db.collection("school_directory").doc(candidate).get();
    if (!existing.exists) return candidate;
  }
  throw new Error("Could not allocate a School ID. Try again.");
}

export const completeSignup = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SignupSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { adminAuth, adminDb } = await import("@/lib/firebase/admin.server");
    const db = adminDb();
    const uid = context.userId;
    const email = context.email;

    if (data.role === "student" && !data.student_code?.trim()) {
      throw new Error("Enter the student ID your school gave you.");
    }
    if ((data.role === "student" || data.role === "teacher") && !data.school_code?.trim()) {
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
      if (existingSchoolId && (existingRole === "institution" || existingRole === "admin")) {
        schoolId = existingSchoolId;
        membership = "owner";
      } else {
        const owned = await db.collection("schools").where("owner_id", "==", uid).limit(1).get();
        const ownedDoc = owned.docs[0];
        if (ownedDoc) {
          schoolId = ownedDoc.id;
          membership = "owner";
        } else {
          const wanted = data.school_code
            ? codeKey(data.school_code)
            : await allocateSignupCode(db);
          const dir = await db.collection("school_directory").doc(wanted).get();
          if (dir.exists) {
            const dirSchoolId = String(dir.get("school_id") ?? "");
            const school = dirSchoolId
              ? await db.collection("schools").doc(dirSchoolId).get()
              : null;
            if (school?.exists && school.get("owner_id") === uid) {
              schoolId = school.id;
            } else {
              throw new Error("That School ID is already taken. Pick another one.");
            }
          } else {
            const schoolRef = db.collection("schools").doc();
            schoolId = schoolRef.id;
            const memberRef = db.collection("school_members").doc();
            const batch = db.batch();
            batch.set(schoolRef, {
              name: data.school_name,
              code: wanted,
              city: null,
              country: null,
              contact_email: email,
              website: null,
              logo_url: null,
              admissions_open: true,
              owner_id: uid,
              created_at: now,
              updated_at: now,
            });
            batch.set(db.collection("school_directory").doc(wanted), {
              school_id: schoolId,
              name: data.school_name,
              city: null,
              country: null,
            });
            batch.set(memberRef, {
              school_id: schoolId,
              user_id: uid,
              role: "institution",
              status: "approved",
              student_code: null,
              created_at: now,
            });
            await batch.commit();
          }
          membership = "owner";
        }
      }
    } else if (data.school_code) {
      const wanted = codeKey(data.school_code);
      const dir = await db.collection("school_directory").doc(wanted).get();
      if (!dir.exists)
        throw new Error("That School ID isn't on Memskool yet. Check it with your school.");
      schoolId = String(dir.get("school_id"));

      if (data.role === "student") {
        const roster = await db
          .collection("school_roster")
          .where("school_id", "==", schoolId)
          .where("student_code", "==", data.student_code)
          .limit(1)
          .get();
        if (roster.empty) {
          throw new Error("That student ID is not on this school's roster yet.");
        }
        const row = roster.docs[0];
        if (row && row.get("claimed_by") && row.get("claimed_by") !== uid) {
          throw new Error("That student ID is already linked to another account.");
        }
        if (row) await row.ref.update({ claimed_by: uid });
        membership = "approved";
      } else if (data.role === "teacher") {
        membership = "pending";
      }

      await db.collection("school_members").add({
        school_id: schoolId,
        user_id: uid,
        role: storedRole,
        status: membership === "pending" ? "pending" : "approved",
        student_code: data.student_code,
        created_at: now,
      });
    }

    const claimRole = storedRole === "institution" ? "admin" : storedRole;
    await adminAuth().setCustomUserClaims(uid, {
      role: claimRole,
      schoolId,
      approved: membership !== "pending",
    });

    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          full_name: data.full_name,
          email,
          avatar_url: null,
          phone: null,
          school_id: schoolId,
          student_code: data.student_code,
          role: storedRole,
          membership_status: membership,
          created_at:
            existingProfile.exists && typeof existingProfile.get("created_at") === "string"
              ? existingProfile.get("created_at")
              : now,
          updated_at: now,
        },
        { merge: true },
      );

    await db.collection("audit_logs").add({
      type: "account_created",
      actor_id: uid,
      school_id: schoolId,
      target_id: uid,
      summary: `Signup as ${storedRole}`,
      created_at: now,
      created_at_server: FieldValue.serverTimestamp(),
    });

    return { schoolId, role: storedRole, membership };
  });
