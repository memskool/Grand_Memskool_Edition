import {
  canApplyAsGoldTutor,
  canEnrolInGoldClass,
  canJoinGoldLesson,
  canPublishGoldClass,
  canStartGoldLesson,
  canSubmitGoldReview,
  enrolmentRequiresPayment,
  goldEnrolmentId,
  goldReviewId,
  ratingAverage,
  splitGoldEarnings,
} from "./policy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(goldEnrolmentId("c1", "u1") === "c1_u1", "enrolment id is deterministic");
assert(goldReviewId("c1", "u1") === "c1_u1", "review id is deterministic");

assert(canApplyAsGoldTutor({}).ok, "new applicant can apply");
assert(canApplyAsGoldTutor({ role: "student" }).ok, "students may apply as independent tutors");
assert(canApplyAsGoldTutor({ role: "teacher" }).ok, "teachers may apply");
assert(!canApplyAsGoldTutor({ role: "parent" }).ok, "parents cannot tutor on Gold");
assert(!canApplyAsGoldTutor({ role: "institution" }).ok, "school accounts cannot tutor on Gold");
assert(!canApplyAsGoldTutor({ alreadyStatus: "pending" }).ok, "pending cannot re-apply");
assert(!canApplyAsGoldTutor({ alreadyStatus: "approved" }).ok, "approved cannot re-apply");

const publishBase = {
  tutorStatus: "approved" as const,
  tutorId: "t1",
  classTutorId: "t1",
  status: "draft" as const,
  title: "Chemistry coaching",
  startsAt: "2026-11-01T10:00:00.000Z",
  endsAt: "2026-11-01T11:00:00.000Z",
  capacity: 12,
  priceCents: 25000,
};
assert(canPublishGoldClass(publishBase).ok, "approved tutor can publish");
assert(
  !canPublishGoldClass({ ...publishBase, tutorStatus: "pending" }).ok,
  "pending tutor cannot publish",
);
assert(
  !canPublishGoldClass({ ...publishBase, endsAt: "2026-11-01T09:00:00.000Z" }).ok,
  "invalid schedule rejected",
);

assert(enrolmentRequiresPayment(100) === true, "paid class needs payment");
assert(enrolmentRequiresPayment(0) === false, "free class skips payment");

assert(
  canEnrolInGoldClass({
    learnerId: "s1",
    tutorId: "t1",
    classStatus: "published",
    capacity: 2,
    activeCount: 1,
  }).ok,
  "open seat enrols",
);
assert(
  !canEnrolInGoldClass({
    learnerId: "t1",
    tutorId: "t1",
    classStatus: "published",
    capacity: 2,
    activeCount: 0,
  }).ok,
  "tutor cannot self-enrol",
);
assert(
  !canEnrolInGoldClass({
    learnerId: "s1",
    tutorId: "t1",
    classStatus: "published",
    capacity: 1,
    activeCount: 1,
  }).ok,
  "full class rejected",
);
assert(
  !canEnrolInGoldClass({
    learnerId: "s1",
    tutorId: "t1",
    classStatus: "published",
    capacity: 4,
    activeCount: 0,
    existingStatus: "active",
  }).ok,
  "duplicate enrolment rejected",
);

assert(
  canStartGoldLesson({
    tutorId: "t1",
    classTutorId: "t1",
    classStatus: "published",
    lessonStatus: "scheduled",
    startsAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  }).ok,
  "tutor can start near start time",
);
assert(
  !canStartGoldLesson({
    tutorId: "t1",
    classTutorId: "t1",
    classStatus: "published",
    lessonStatus: "scheduled",
    startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  }).ok,
  "cannot start an hour early",
);

assert(
  canJoinGoldLesson({
    userId: "s1",
    tutorId: "t1",
    lessonStatus: "live",
    enrolmentStatus: "active",
  }).ok,
  "enrolled learner joins live lesson",
);
assert(
  !canJoinGoldLesson({
    userId: "s1",
    tutorId: "t1",
    lessonStatus: "scheduled",
    enrolmentStatus: "active",
  }).ok,
  "cannot join before live",
);

assert(
  canSubmitGoldReview({
    learnerId: "s1",
    tutorId: "t1",
    enrolmentStatus: "active",
    attended: true,
    alreadyReviewed: false,
  }).ok,
  "eligible review",
);
assert(
  !canSubmitGoldReview({
    learnerId: "s1",
    tutorId: "t1",
    enrolmentStatus: "active",
    attended: false,
    alreadyReviewed: false,
  }).ok,
  "no review without attendance",
);

const split = splitGoldEarnings(10_000, 1000);
assert(split.commissionCents === 1000, "10% commission");
assert(split.tutorCents === 9000, "tutor share");
assert(ratingAverage(14, 4) === 3.5, "rating average one decimal");
assert(ratingAverage(0, 0) === null, "no fake rating when empty");

console.log("gold policy tests passed");
