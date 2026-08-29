/** One online school per institution account. */

export function emailsMatch(a: unknown, b: string): boolean {
  return typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The school this institution already owns, if any. */
export function resolveOwnedSchoolId(input: {
  userId: string;
  schoolDocAtUserId: boolean;
  profileSchoolId: string | null | undefined;
  profileSchoolOwnerId: string | null | undefined;
}): string | null {
  if (input.schoolDocAtUserId) return input.userId;
  if (
    input.profileSchoolId &&
    (input.profileSchoolOwnerId === input.userId || input.profileSchoolId === input.userId)
  ) {
    return input.profileSchoolId;
  }
  return null;
}

/**
 * Same person reclaiming a school (Auth UID recreation, missing owner, matching email).
 * Does not allow claiming a living owner's school just because contact_email matches.
 */
export function canReclaimSchoolAsOwner(input: {
  ownerId: string | null | undefined;
  contactEmail: string | null | undefined;
  currentUid: string;
  email: string;
  ownerEmail?: string | null | undefined;
  ownerExists?: boolean | undefined;
}): boolean {
  const ownerId = input.ownerId ? String(input.ownerId) : "";
  if (ownerId === input.currentUid) return true;

  const contactMatches = emailsMatch(input.contactEmail, input.email);
  const ownerEmailMatches = emailsMatch(input.ownerEmail, input.email);

  if (!ownerId) return contactMatches;
  if (input.ownerExists === false) return contactMatches;
  return ownerEmailMatches;
}

/**
 * Whether this account may attach to `targetSchoolId`.
 * An institution that already owns a school cannot switch to a different one.
 */
export function canAdoptTargetSchool(input: {
  targetSchoolId: string;
  alreadyOwnedSchoolId: string | null;
  ownerId: string | null | undefined;
  contactEmail: string | null | undefined;
  currentUid: string;
  email: string;
  ownerEmail?: string | null | undefined;
  ownerExists?: boolean | undefined;
}): boolean {
  if (input.alreadyOwnedSchoolId && input.alreadyOwnedSchoolId !== input.targetSchoolId) {
    return false;
  }
  return canReclaimSchoolAsOwner(input);
}
