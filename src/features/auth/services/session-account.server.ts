import "@tanstack/react-start/server-only";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin.server";
import { adminSet } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { plainFirestoreData } from "@/lib/firebase/plain-data";
import type { AppRole } from "@/types/roles";
import type { UserProfile } from "@/types/user";
import { DIRECTORY_INDEX_ID } from "@/lib/school-catalog.server";
import type { School } from "@/types/school";
import {
  canAdoptTargetSchool,
  canReclaimSchoolAsOwner,
  emailsMatch,
  resolveOwnedSchoolId,
} from "@/lib/school-ownership";

export function emailDirectoryId(email: string): string {
  return email.trim().toLowerCase();
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

async function listedSchoolIds(db: Firestore): Promise<string[]> {
  const index = await db.collection(COLLECTIONS.schoolDirectory).doc(DIRECTORY_INDEX_ID).get();
  const fromIndex = Array.isArray(index.get("school_ids"))
    ? (index.get("school_ids") as string[]).filter(Boolean)
    : [];
  if (fromIndex.length > 0) return fromIndex.slice(0, 100);

  const catalog = await db.collection("ops").doc("school_catalog").get();
  const fromCatalog = Array.isArray(catalog.get("school_ids"))
    ? (catalog.get("school_ids") as string[]).filter(Boolean)
    : [];
  return fromCatalog.slice(0, 100);
}

async function ownerLookup(
  db: Firestore,
  ownerId: string,
): Promise<{ exists: boolean; email: string | null }> {
  if (!ownerId) return { exists: false, email: null };
  const owner = await db.collection(COLLECTIONS.users).doc(ownerId).get();
  return {
    exists: owner.exists,
    email:
      owner.exists && typeof owner.get("email") === "string" ? String(owner.get("email")) : null,
  };
}

async function canTakeSchoolOwnership(
  db: Firestore,
  school: DocumentData,
  currentUid: string,
  email: string,
): Promise<boolean> {
  const ownerId = String(school["owner_id"] ?? "");
  const owner = ownerId && ownerId !== currentUid ? await ownerLookup(db, ownerId) : null;
  return canReclaimSchoolAsOwner({
    ownerId,
    contactEmail: typeof school["contact_email"] === "string" ? school["contact_email"] : null,
    currentUid,
    email,
    ownerEmail: owner?.email ?? null,
    ownerExists: owner ? owner.exists : undefined,
  });
}

async function alreadyOwnedSchoolId(
  db: Firestore,
  currentUid: string,
  profileSchoolId?: string | null,
): Promise<string | null> {
  const ownedAtUid = await db.collection(COLLECTIONS.schools).doc(currentUid).get();
  let profileOwnerId: string | null = null;
  if (profileSchoolId && profileSchoolId !== currentUid) {
    const profileSchool = await db.collection(COLLECTIONS.schools).doc(profileSchoolId).get();
    profileOwnerId = profileSchool.exists ? String(profileSchool.get("owner_id") ?? "") : null;
  } else if (ownedAtUid.exists) {
    profileOwnerId = String(ownedAtUid.get("owner_id") ?? currentUid);
  }
  return resolveOwnedSchoolId({
    userId: currentUid,
    schoolDocAtUserId: ownedAtUid.exists,
    profileSchoolId,
    profileSchoolOwnerId: profileOwnerId,
  });
}

async function writeOwnerProfile(
  db: Firestore,
  currentUid: string,
  email: string,
  schoolId: string,
  extras: {
    fullName: string;
    phone?: string | null | undefined;
    avatarUrl?: string | null | undefined;
    createdAt?: string | undefined;
    orphanId?: string | null | undefined;
  },
): Promise<UserProfile> {
  const now = new Date().toISOString();
  const payload = plainFirestoreData({
    full_name: extras.fullName,
    email,
    avatar_url: extras.avatarUrl ?? null,
    phone: extras.phone ?? null,
    school_id: schoolId,
    student_code: null,
    role: "institution" as AppRole,
    membership_status: "owner",
    created_at: extras.createdAt ?? now,
    updated_at: now,
    ...(extras.orphanId ? { reattached_from: extras.orphanId } : {}),
  });
  await adminSet(COLLECTIONS.users, currentUid, payload);

  const school = await db.collection(COLLECTIONS.schools).doc(schoolId).get();
  if (school.exists) {
    await school.ref.set(
      {
        owner_id: currentUid,
        created_by: currentUid,
        contact_email: email,
        updated_at: now,
      },
      { merge: true },
    );
  }

  await adminSet(
    COLLECTIONS.schoolMembers,
    currentUid,
    plainFirestoreData({
      school_id: schoolId,
      user_id: currentUid,
      role: "institution",
      status: "approved",
      student_code: null,
      created_at: now,
      updated_at: now,
    }),
  );

  await adminAuth().setCustomUserClaims(currentUid, {
    role: "admin",
    schoolId,
    approved: true,
  });
  await rememberUserDirectory(email, currentUid, { role: "institution", schoolId });

  return mapProfile(currentUid, payload)!;
}

async function findOrphanUserId(
  db: Firestore,
  email: string,
  currentUid: string,
): Promise<string | null> {
  const dir = await db.collection(COLLECTIONS.userDirectory).doc(emailDirectoryId(email)).get();
  if (dir.exists) {
    const mapped = String(dir.get("user_id") ?? "");
    if (mapped && mapped !== currentUid) return mapped;
  }

  for (const schoolId of await listedSchoolIds(db)) {
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

  const data = orphan.data() ?? {};
  const schoolId = typeof data["school_id"] === "string" ? data["school_id"] : null;
  if (!schoolId) {
    // Fall through to contact-email claim below.
    return null;
  }

  return writeOwnerProfile(db, currentUid, email, schoolId, {
    fullName: String(data["full_name"] || email),
    phone: (data["phone"] as string | null) ?? null,
    avatarUrl: (data["avatar_url"] as string | null) ?? null,
    ...(typeof data["created_at"] === "string" ? { createdAt: data["created_at"] } : {}),
    orphanId,
  });
}

/** Take ownership of a school whose contact email matches the signed-in user. */
async function claimSchoolByContactEmail(
  db: Firestore,
  currentUid: string,
  email: string,
  preferredSchoolId?: string | null,
): Promise<UserProfile | null> {
  const ownedId = await alreadyOwnedSchoolId(db, currentUid, preferredSchoolId ?? null);
  if (ownedId) {
    const owned = await db.collection(COLLECTIONS.schools).doc(ownedId).get();
    if (owned.exists) {
      const display =
        (await db.collection(COLLECTIONS.users).doc(currentUid).get()).get("full_name") ||
        String(owned.get("name") || "School admin");
      return writeOwnerProfile(db, currentUid, email, ownedId, {
        fullName: String(display),
      });
    }
  }

  const ids = preferredSchoolId
    ? [preferredSchoolId, ...(await listedSchoolIds(db)).filter((id) => id !== preferredSchoolId)]
    : await listedSchoolIds(db);

  for (const schoolId of ids) {
    const school = await db.collection(COLLECTIONS.schools).doc(schoolId).get();
    if (!school.exists) continue;
    const data = school.data() ?? {};
    const ownerId = String(data["owner_id"] ?? "");
    const owner = ownerId && ownerId !== currentUid ? await ownerLookup(db, ownerId) : null;
    if (
      !canAdoptTargetSchool({
        targetSchoolId: schoolId,
        alreadyOwnedSchoolId: ownedId,
        ownerId,
        contactEmail: typeof data["contact_email"] === "string" ? data["contact_email"] : null,
        currentUid,
        email,
        ownerEmail: owner?.email ?? null,
        ownerExists: owner ? owner.exists : undefined,
      })
    ) {
      continue;
    }
    if (!emailsMatch(data["contact_email"], email) && ownerId !== currentUid) {
      continue;
    }

    const display =
      (await db.collection(COLLECTIONS.users).doc(currentUid).get()).get("full_name") ||
      String(data["name"] || "School admin");

    return writeOwnerProfile(db, currentUid, email, schoolId, {
      fullName: String(display),
    });
  }
  return null;
}

async function ensureClaimsMatchProfile(profile: UserProfile): Promise<void> {
  try {
    const user = await adminAuth().getUser(profile.id);
    const claims = user.customClaims ?? {};
    const wantRole = profile.role === "institution" ? "admin" : profile.role;
    const haveRole = typeof claims["role"] === "string" ? claims["role"] : null;
    const haveSchool = typeof claims["schoolId"] === "string" ? claims["schoolId"] : null;
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
 * Recovers when Auth was recreated (new UID) and the school still lists their email.
 */
export async function resolveSessionAccount(input: {
  userId: string;
  email: string | null;
}): Promise<UserProfile | null> {
  const db = adminDb();
  const existing = await db.collection(COLLECTIONS.users).doc(input.userId).get();
  let profile = existing.exists ? mapProfile(input.userId, existing.data()) : null;

  const existingRole = existing.exists ? String(existing.get("role") ?? "") : "";
  const isInstitution =
    existingRole === "institution" || existingRole === "admin" || profile?.role === "institution";
  if (isInstitution) {
    const ownedId = await alreadyOwnedSchoolId(db, input.userId, profile?.school_id ?? null);
    if (ownedId) {
      if (profile?.school_id !== ownedId && input.email) {
        profile = await writeOwnerProfile(db, input.userId, input.email, ownedId, {
          fullName: String(profile?.full_name || existing.get("full_name") || "School admin"),
          phone: profile?.phone ?? (existing.get("phone") as string | null) ?? null,
          avatarUrl: profile?.avatar_url ?? (existing.get("avatar_url") as string | null) ?? null,
          createdAt: profile?.created_at || undefined,
        });
      } else if (profile) {
        await ensureClaimsMatchProfile({ ...profile, school_id: ownedId });
        if (profile.school_id !== ownedId) {
          profile = { ...profile, school_id: ownedId };
        }
      }
      if (profile?.school_id) return profile;
    }
    if (profile?.school_id && input.email) {
      const now = new Date().toISOString();
      await adminSet(COLLECTIONS.users, input.userId, {
        school_id: null,
        updated_at: now,
      });
      try {
        await adminAuth().setCustomUserClaims(input.userId, {
          role: "admin",
          schoolId: null,
          approved: true,
        });
      } catch (error) {
        console.error("[session] failed to detach foreign school:", error);
      }
      profile = { ...profile, school_id: null };
    }
  }

  if (profile?.school_id) {
    if (input.email) {
      void rememberUserDirectory(input.email, input.userId, {
        role: profile.role,
        schoolId: profile.school_id,
      });
      // Keep school.owner_id aligned when Auth UID was recreated.
      try {
        const school = await db.collection(COLLECTIONS.schools).doc(profile.school_id).get();
        if (
          school.exists &&
          String(school.get("owner_id") ?? "") !== input.userId &&
          (await canTakeSchoolOwnership(db, school.data() ?? {}, input.userId, input.email))
        ) {
          await school.ref.set(
            {
              owner_id: input.userId,
              created_by: input.userId,
              contact_email: input.email,
              updated_at: new Date().toISOString(),
            },
            { merge: true },
          );
        }
      } catch (error) {
        console.error("[session] failed to realign school owner:", error);
      }
    }
    await ensureClaimsMatchProfile(profile);
    return profile;
  }

  if (!input.email?.trim()) return profile;

  if (!profile) {
    const orphanId = await findOrphanUserId(db, input.email, input.userId);
    if (orphanId) {
      profile = await reattachOrphanProfile(db, input.userId, input.email, orphanId);
      if (profile?.school_id) return profile;
    }
  }

  const claimed = await claimSchoolByContactEmail(
    db,
    input.userId,
    input.email,
    profile?.school_id,
  );
  if (claimed) return claimed;
  if (profile) await ensureClaimsMatchProfile(profile);
  return profile;
}

/** Open / manage a school — only the one this institution already owns (or can reclaim). */
export async function adoptManagedSchool(input: {
  userId: string;
  email: string | null;
  schoolId: string;
}): Promise<{ profile: UserProfile; school: School & { id: string } }> {
  if (!input.email?.trim()) {
    throw new Error("Your account needs an email before you can manage a school.");
  }
  const db = adminDb();
  const school = await db.collection(COLLECTIONS.schools).doc(input.schoolId).get();
  if (!school.exists) throw new Error("That school was not found.");
  const data = school.data() ?? {};
  const profileSnap = await db.collection(COLLECTIONS.users).doc(input.userId).get();
  const profileSchoolId =
    profileSnap.exists && typeof profileSnap.get("school_id") === "string"
      ? String(profileSnap.get("school_id"))
      : null;
  const ownedId = await alreadyOwnedSchoolId(db, input.userId, profileSchoolId);
  const ownerId = String(data["owner_id"] ?? "");
  const owner = ownerId && ownerId !== input.userId ? await ownerLookup(db, ownerId) : null;
  if (
    !canAdoptTargetSchool({
      targetSchoolId: input.schoolId,
      alreadyOwnedSchoolId: ownedId,
      ownerId,
      contactEmail: typeof data["contact_email"] === "string" ? data["contact_email"] : null,
      currentUid: input.userId,
      email: input.email,
      ownerEmail: owner?.email ?? null,
      ownerExists: owner ? owner.exists : undefined,
    })
  ) {
    throw new Error(
      ownedId && ownedId !== input.schoolId
        ? "This account already manages one school."
        : "You can only manage the school registered to this account.",
    );
  }

  const profile = await writeOwnerProfile(db, input.userId, input.email, input.schoolId, {
    fullName: String(
      (await db.collection(COLLECTIONS.users).doc(input.userId).get()).get("full_name") ||
        data["name"] ||
        "School admin",
    ),
  });

  return {
    profile,
    school: {
      ...(data as School),
      id: school.id,
      owner_id: input.userId,
      contact_email: input.email,
    },
  };
}

export async function loadManagedSchool(input: { userId: string; email: string | null }): Promise<
  | (School & {
      id: string;
      membership: "owner" | "approved" | "pending" | "rejected";
      memberRole: AppRole;
    })
  | null
> {
  const profile = await resolveSessionAccount(input);
  if (!profile?.school_id) return null;
  const school = await adminDb().collection(COLLECTIONS.schools).doc(profile.school_id).get();
  if (!school.exists) return null;
  const membership =
    profile.membership_status === "owner" ||
    profile.role === "institution" ||
    profile.role === "admin"
      ? "owner"
      : profile.membership_status === "pending" ||
          profile.membership_status === "rejected" ||
          profile.membership_status === "approved"
        ? profile.membership_status
        : "approved";
  return {
    ...(school.data() as School),
    id: school.id,
    membership,
    memberRole: profile.role,
  };
}
