import "@tanstack/react-start/server-only";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin.server";
import { adminSet } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { plainFirestoreData } from "@/lib/firebase/plain-data";
import type { AppRole } from "@/types/roles";
import type { UserProfile } from "@/types/user";
import { DIRECTORY_INDEX_ID } from "@/lib/school-catalog.server";

export function emailDirectoryId(email: string): string {
  return email.trim().toLowerCase();
}

function emailsMatch(a: unknown, b: string): boolean {
  return typeof a === "string" && a.trim().toLowerCase() === emailDirectoryId(b);
}

function mapProfile(id: string, data: DocumentData | undefined): UserProfile | null {
  if (!data) return null;
  const role = data["role"];
  const fullName = data["full_name"];
  if (typeof role !== "string" || !role || typeof fullName !== "string" || !fullName.trim()) {
    return null;
  }
  return {
    id,
    full_name: fullName,
    email: typeof data["email"] === "string" ? data["email"] : null,
    avatar_url: (data["avatar_url"] as string | null) ?? null,
    phone: (data["phone"] as string | null) ?? null,
    school_id: typeof data["school_id"] === "string" ? data["school_id"] : null,
    student_code: (data["student_code"] as string | null) ?? null,
    role: (role === "admin" ? "institution" : role) as AppRole,
    membership_status: (data["membership_status"] as UserProfile["membership_status"]) ?? null,
    created_at: typeof data["created_at"] === "string" ? data["created_at"] : "",
    updated_at: typeof data["updated_at"] === "string" ? data["updated_at"] : "",
  };
}

export async function rememberUserDirectory(
  email: string | null | undefined,
  userId: string,
  extras?: { role?: string | null; schoolId?: string | null },
): Promise<void> {
  if (!email?.trim() || !userId) return;
  await adminSet(COLLECTIONS.userDirectory, emailDirectoryId(email), {
    user_id: userId,
    role: extras?.role ?? null,
    school_id: extras?.schoolId ?? null,
    updated_at: new Date().toISOString(),
  });
}

async function findOrphanUserId(db: Firestore, email: string, currentUid: string): Promise<string | null> {
  const dir = await db.collection(COLLECTIONS.userDirectory).doc(emailDirectoryId(email)).get();
  if (dir.exists) {
    const mapped = String(dir.get("user_id") ?? "");
    if (mapped && mapped !== currentUid) return mapped;
  }

  const index = await db.collection(COLLECTIONS.schoolDirectory).doc(DIRECTORY_INDEX_ID).get();
  const schoolIds = Array.isArray(index.get("school_ids"))
    ? (index.get("school_ids") as string[]).filter(Boolean)
    : [];
  for (const schoolId of schoolIds.slice(0, 100)) {
    const school = await db.collection(COLLECTIONS.schools).doc(schoolId).get();
    if (!school.exists) continue;
    if (!emailsMatch(school.get("contact_email"), email)) continue;
    const ownerId = String(school.get("owner_id") ?? "");
    if (!ownerId || ownerId === currentUid) continue;
    const owner = await db.collection(COLLECTIONS.users).doc(ownerId).get();
    if (owner.exists && emailsMatch(owner.get("email"), email)) return ownerId;
  }
  return null;
}

async function reattachOrphanProfile(
  db: Firestore,
  currentUid: string,
  email: string,
  orphanId: string,
): Promise<UserProfile | null> {
  const orphan = await db.collection(COLLECTIONS.users).doc(orphanId).get();
  if (!orphan.exists || !emailsMatch(orphan.get("email"), email)) return null;

  const now = new Date().toISOString();
  const data = orphan.data() ?? {};
  const schoolId = typeof data["school_id"] === "string" ? data["school_id"] : null;
  const roleRaw = typeof data["role"] === "string" ? data["role"] : "student";
  const role: AppRole = roleRaw === "admin" ? "institution" : (roleRaw as AppRole);
  const membership =
    data["membership_status"] === "owner" ||
    data["membership_status"] === "pending" ||
    data["membership_status"] === "approved" ||
    data["membership_status"] === "rejected"
      ? data["membership_status"]
      : role === "institution"
        ? "owner"
        : "approved";

  await adminSet(
    COLLECTIONS.users,
    currentUid,
    plainFirestoreData({
      full_name: data["full_name"],
      email,
      avatar_url: data["avatar_url"] ?? null,
      phone: data["phone"] ?? null,
      school_id: schoolId,
      student_code: data["student_code"] ?? null,
      role,
      membership_status: membership,
      created_at: data["created_at"] ?? now,
      updated_at: now,
      reattached_from: orphanId,
    }),
  );

  if (schoolId) {
    const school = await db.collection(COLLECTIONS.schools).doc(schoolId).get();
    if (school.exists && String(school.get("owner_id") ?? "") === orphanId) {
      await school.ref.set(
        {
          owner_id: currentUid,
          created_by: currentUid,
          updated_at: now,
        },
        { merge: true },
      );
    }
    const oldMember = await db.collection(COLLECTIONS.schoolMembers).doc(orphanId).get();
    const memberPayload = oldMember.exists
      ? {
          ...oldMember.data(),
          user_id: currentUid,
          school_id: schoolId,
          updated_at: now,
        }
      : {
          school_id: schoolId,
          user_id: currentUid,
          role,
          status: membership === "owner" ? "approved" : membership,
          created_at: now,
        };
    await adminSet(COLLECTIONS.schoolMembers, currentUid, plainFirestoreData(memberPayload));
  }

  const claimRole = role === "institution" ? "admin" : role;
  await adminAuth().setCustomUserClaims(currentUid, {
    role: claimRole,
    schoolId,
    approved: membership !== "pending",
  });

  await rememberUserDirectory(email, currentUid, { role, schoolId });
  return mapProfile(currentUid, {
    ...data,
    email,
    role,
    membership_status: membership,
    school_id: schoolId,
    updated_at: now,
  });
}

async function ensureClaimsMatchProfile(profile: UserProfile): Promise<void> {
  try {
    const user = await adminAuth().getUser(profile.id);
    const claims = user.customClaims ?? {};
    const wantRole = profile.role === "institution" ? "admin" : profile.role;
    const haveRole = typeof claims["role"] === "string" ? claims["role"] : null;
    const haveSchool =
      typeof claims["schoolId"] === "string" ? claims["schoolId"] : claims["schoolId"] === null ? null : undefined;
    if (haveRole === wantRole && haveSchool === profile.school_id) return;
    await adminAuth().setCustomUserClaims(profile.id, {
      role: wantRole,
      schoolId: profile.school_id,
      approved: profile.membership_status !== "pending",
    });
  } catch (error) {
    console.error("[session] failed to sync claims:", error);
  }
}

/**
 * Load the signed-in user's profile via Admin SDK.
 * If Auth was recreated (new UID) but an older profile exists for the same email,
 * reattach that profile and school ownership so refresh no longer dumps them on onboarding.
 */
export async function resolveSessionAccount(input: {
  userId: string;
  email: string | null;
}): Promise<UserProfile | null> {
  const db = adminDb();
  const existing = await db.collection(COLLECTIONS.users).doc(input.userId).get();
  if (existing.exists) {
    const profile = mapProfile(input.userId, existing.data());
    if (profile) {
      if (input.email) {
        void rememberUserDirectory(input.email, input.userId, {
          role: profile.role,
          schoolId: profile.school_id,
        });
      }
      await ensureClaimsMatchProfile(profile);
      return profile;
    }
  }

  if (!input.email?.trim()) return null;
  const orphanId = await findOrphanUserId(db, input.email, input.userId);
  if (!orphanId) return null;
  return reattachOrphanProfile(db, input.userId, input.email, orphanId);
}
