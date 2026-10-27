import {
  canCountHomeView,
  canManageOwnHomeVideo,
  canModerateHomeVideo,
  canPublishOnSchoolChannel,
  canReportHomeVideo,
  canSubmitHomeVideo,
  canUploadAgainToday,
  canUploadHomeVideo,
  homeLikeId,
  isPublishedHomeVideo,
  rankHomeVideos,
} from "./policy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(homeLikeId("v1", "u1") === "v1_u1", "like id is deterministic");
assert(isPublishedHomeVideo("published"), "published is public");
assert(!isPublishedHomeVideo("draft"), "draft is not public");
assert(!isPublishedHomeVideo("pending_review"), "pending is not public");

assert(
  canUploadHomeVideo({ role: "teacher", teacherApproved: true }).ok,
  "approved teacher uploads",
);
assert(
  !canUploadHomeVideo({ role: "teacher", teacherApproved: false }).ok,
  "pending teacher blocked",
);
assert(!canUploadHomeVideo({ role: "student" }).ok, "students cannot upload");
assert(
  canUploadHomeVideo({ role: "student", goldApproved: true }).ok,
  "verified Gold creator can upload",
);
assert(canUploadHomeVideo({ role: "admin" }).ok, "school admin uploads");

assert(
  canPublishOnSchoolChannel({
    role: "admin",
    claimSchoolId: "s1",
    targetSchoolId: "s1",
  }).ok,
  "admin publishes own school",
);
assert(
  !canPublishOnSchoolChannel({
    role: "admin",
    claimSchoolId: "s1",
    targetSchoolId: "s2",
  }).ok,
  "cannot publish on another school",
);
assert(
  !canPublishOnSchoolChannel({
    role: "teacher",
    claimSchoolId: "s1",
    targetSchoolId: "s1",
  }).ok,
  "teachers cannot hijack school channel",
);

const submitBase = {
  status: "draft" as const,
  ownerId: "u1",
  actorId: "u1",
  title: "Photosynthesis in 60 seconds",
  description: "A short biology recap for lower secondary.",
  rightsConfirmed: true,
  noIdentifiableStudents: true,
  hasVideoFile: true,
  bytes: 1_000_000,
  mimeType: "video/mp4",
  durationSeconds: 45,
};
assert(canSubmitHomeVideo(submitBase).ok, "valid draft submits");
assert(!canSubmitHomeVideo({ ...submitBase, actorId: "u2" }).ok, "non-owner cannot submit");
assert(!canSubmitHomeVideo({ ...submitBase, rightsConfirmed: false }).ok, "rights required");
assert(!canSubmitHomeVideo({ ...submitBase, durationSeconds: 4 }).ok, "too short rejected");
assert(!canSubmitHomeVideo({ ...submitBase, bytes: 90 * 1024 * 1024 }).ok, "oversize rejected");
assert(!canSubmitHomeVideo({ ...submitBase, status: "published" }).ok, "already published");

assert(canModerateHomeVideo({ role: "superadmin" }), "superadmin moderates");
assert(!canModerateHomeVideo({ role: "admin" }), "school admin cannot moderate platform queue");

assert(
  canManageOwnHomeVideo({
    actorId: "u1",
    creatorId: "u1",
    role: "teacher",
    claimSchoolId: "s1",
    videoSchoolId: null,
  }),
  "creator manages own video",
);
assert(
  canManageOwnHomeVideo({
    actorId: "admin1",
    creatorId: "u1",
    role: "admin",
    claimSchoolId: "s1",
    videoSchoolId: "s1",
  }),
  "school admin manages school channel video",
);
assert(
  !canManageOwnHomeVideo({
    actorId: "admin1",
    creatorId: "u1",
    role: "admin",
    claimSchoolId: "s1",
    videoSchoolId: "s2",
  }),
  "other school cannot manage",
);

assert(canCountHomeView({ userId: "u1", lastCountedAt: null, nowMs: 1000 }), "first view counts");
assert(
  !canCountHomeView({ userId: null, lastCountedAt: null, nowMs: 1000 }),
  "anonymous views are not counted",
);
assert(
  !canCountHomeView({
    userId: "u1",
    lastCountedAt: new Date(1000).toISOString(),
    nowMs: 1000 + 60_000,
    windowMs: 12 * 60 * 60 * 1000,
  }),
  "refresh inside window does not recount",
);
assert(
  canCountHomeView({
    userId: "u1",
    lastCountedAt: new Date(0).toISOString(),
    nowMs: 13 * 60 * 60 * 1000,
  }),
  "view after window counts again",
);

assert(canReportHomeVideo({ lastReportAt: null, nowMs: 1000 }).ok, "first report ok");
assert(
  !canReportHomeVideo({
    lastReportAt: new Date(1000).toISOString(),
    nowMs: 2000,
    cooldownMs: 60_000,
  }).ok,
  "report cooldown",
);

assert(canUploadAgainToday({ uploadsToday: 7 }), "under daily cap");
assert(!canUploadAgainToday({ uploadsToday: 8 }), "daily cap reached");

const ranked = rankHomeVideos(
  [
    {
      id: "old",
      title: "Old maths",
      description: "algebra",
      subject: "mathematics",
      topic: null,
      level: "primary",
      creator_name: "Ada",
      school_name: null,
      published_at: "2020-01-01T00:00:00.000Z",
      like_count: 0,
      view_count: 0,
    },
    {
      id: "hot",
      title: "Hot chemistry",
      description: "atoms",
      subject: "chemistry",
      topic: null,
      level: "primary",
      creator_name: "Ada",
      school_name: "Altrastate",
      published_at: new Date().toISOString(),
      like_count: 9,
      view_count: 4,
    },
  ],
  { query: "chem", nowMs: Date.now() },
);
assert(ranked.length === 1 && ranked[0]?.id === "hot", "search and ranking keep the relevant clip");

const hiddenDraft = rankHomeVideos(
  [
    {
      id: "seen",
      title: "Repeat",
      description: "repeat",
      subject: "biology",
      topic: null,
      level: "primary",
      creator_name: "Ada",
      school_name: null,
      published_at: new Date().toISOString(),
      like_count: 1,
      view_count: 1,
    },
  ],
  { seenIds: ["seen"] },
);
assert(hiddenDraft.length === 0, "already-seen ids are not repeated");

console.log("home policy tests passed");
