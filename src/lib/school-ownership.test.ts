import {
  canAdoptTargetSchool,
  canReclaimSchoolAsOwner,
  emailsMatch,
  resolveOwnedSchoolId,
} from "./school-ownership";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(emailsMatch("Ada@School.org", "ada@school.org"), "emails match case-insensitively");
assert(!emailsMatch(null, "ada@school.org"), "null email does not match");

assert(
  resolveOwnedSchoolId({
    userId: "uid-1",
    schoolDocAtUserId: true,
    profileSchoolId: "other-school",
    profileSchoolOwnerId: "someone-else",
  }) === "uid-1",
  "schools/{uid} wins even if profile points elsewhere",
);

assert(
  resolveOwnedSchoolId({
    userId: "uid-1",
    schoolDocAtUserId: false,
    profileSchoolId: "legacy-uuid",
    profileSchoolOwnerId: "uid-1",
  }) === "legacy-uuid",
  "legacy owned school is kept when there is no schools/{uid} doc",
);

assert(
  resolveOwnedSchoolId({
    userId: "uid-1",
    schoolDocAtUserId: false,
    profileSchoolId: "other-school",
    profileSchoolOwnerId: "someone-else",
  }) === null,
  "cannot treat another owner's school as owned",
);

assert(
  canReclaimSchoolAsOwner({
    ownerId: "uid-1",
    contactEmail: "other@school.org",
    currentUid: "uid-1",
    email: "me@school.org",
  }),
  "owner can always reclaim their own school",
);

assert(
  !canReclaimSchoolAsOwner({
    ownerId: "",
    contactEmail: null,
    currentUid: "uid-1",
    email: "me@school.org",
  }),
  "unowned school without matching contact email cannot be claimed",
);

assert(
  canReclaimSchoolAsOwner({
    ownerId: "",
    contactEmail: "me@school.org",
    currentUid: "uid-1",
    email: "me@school.org",
  }),
  "unowned school with matching contact email can be reclaimed",
);

assert(
  !canReclaimSchoolAsOwner({
    ownerId: "uid-2",
    contactEmail: "me@school.org",
    currentUid: "uid-1",
    email: "me@school.org",
    ownerExists: true,
    ownerEmail: "owner@school.org",
  }),
  "matching contact email does not steal a living owner's school",
);

assert(
  canReclaimSchoolAsOwner({
    ownerId: "old-uid",
    contactEmail: "me@school.org",
    currentUid: "uid-1",
    email: "me@school.org",
    ownerExists: true,
    ownerEmail: "me@school.org",
  }),
  "same person with a new Auth UID can reclaim",
);

assert(
  !canAdoptTargetSchool({
    targetSchoolId: "school-b",
    alreadyOwnedSchoolId: "school-a",
    ownerId: "uid-1",
    contactEmail: "me@school.org",
    currentUid: "uid-1",
    email: "me@school.org",
  }),
  "cannot switch to a second school",
);

assert(
  canAdoptTargetSchool({
    targetSchoolId: "school-a",
    alreadyOwnedSchoolId: "school-a",
    ownerId: "uid-1",
    contactEmail: "me@school.org",
    currentUid: "uid-1",
    email: "me@school.org",
  }),
  "opening the school you already own is allowed",
);

console.log("school-ownership tests passed");
