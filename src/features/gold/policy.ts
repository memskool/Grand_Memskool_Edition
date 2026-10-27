/** Pure Gold marketplace rules — no I/O. Server and tests share this. */

export const GOLD_SUBJECTS = [
  "mathematics",
  "chemistry",
  "physics",
  "biology",
  "geography",
  "english",
  "history",
  "economics",
  "computer_science",
  "exam_prep",
  "other",
] as const;

export const GOLD_LEVELS = [
  "nursery",
  "primary",
  "lower_secondary",
  "upper_secondary",
  "alevel",
  "university",
  "professional",
] as const;

export const GOLD_DELIVERY = ["live", "recorded", "mixed"] as const;

export const GOLD_APPLICATION_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export const GOLD_CLASS_STATUSES = ["draft", "published", "completed", "cancelled"] as const;
export const GOLD_ENROLMENT_STATUSES = [
  "pending_payment",
  "active",
  "cancelled",
  "completed",
] as const;
export const GOLD_LESSON_STATUSES = ["scheduled", "live", "ended", "cancelled"] as const;

export type GoldSubject = (typeof GOLD_SUBJECTS)[number];
export type GoldLevel = (typeof GOLD_LEVELS)[number];
export type GoldDelivery = (typeof GOLD_DELIVERY)[number];
export type GoldApplicationStatus = (typeof GOLD_APPLICATION_STATUSES)[number];
export type GoldClassStatus = (typeof GOLD_CLASS_STATUSES)[number];
export type GoldEnrolmentStatus = (typeof GOLD_ENROLMENT_STATUSES)[number];
export type GoldLessonStatus = (typeof GOLD_LESSON_STATUSES)[number];

export const DEFAULT_GOLD_COMMISSION_BPS = 1000; // 10%
export const MAX_CLASS_CAPACITY = 80;
export const MIN_LESSON_MINUTES = 20;
export const MAX_LESSON_MINUTES = 240;

export function goldEnrolmentId(classId: string, learnerId: string): string {
  return `${classId}_${learnerId}`;
}

export function goldReviewId(classId: string, learnerId: string): string {
  return `${classId}_${learnerId}`;
}

export function isApprovedGoldTutor(status: GoldApplicationStatus | null | undefined): boolean {
  return status === "approved";
}

export function canApplyAsGoldTutor(input: {
  alreadyStatus?: GoldApplicationStatus | null;
}): { ok: true } | { ok: false; reason: string } {
  if (input.alreadyStatus === "pending") {
    return { ok: false, reason: "Your Gold application is already under review." };
  }
  if (input.alreadyStatus === "approved") {
    return { ok: false, reason: "This account is already an approved Gold tutor." };
  }
  if (input.alreadyStatus === "suspended") {
    return { ok: false, reason: "This Gold tutor account is suspended." };
  }
  return { ok: true };
}

export function canPublishGoldClass(input: {
  tutorStatus: GoldApplicationStatus | null | undefined;
  tutorId: string;
  classTutorId: string;
  status: GoldClassStatus;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceCents: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!isApprovedGoldTutor(input.tutorStatus)) {
    return { ok: false, reason: "Only approved Gold tutors can publish classes." };
  }
  if (input.tutorId !== input.classTutorId) {
    return { ok: false, reason: "You can only publish your own class." };
  }
  if (input.status === "cancelled") {
    return { ok: false, reason: "A cancelled class cannot be published." };
  }
  if (!input.title.trim()) return { ok: false, reason: "A class title is required." };
  if (input.capacity < 1 || input.capacity > MAX_CLASS_CAPACITY) {
    return { ok: false, reason: `Capacity must be between 1 and ${MAX_CLASS_CAPACITY}.` };
  }
  if (input.priceCents < 0) return { ok: false, reason: "Price cannot be negative." };
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ok: false, reason: "The class schedule is invalid." };
  }
  return { ok: true };
}

export function enrolmentRequiresPayment(priceCents: number): boolean {
  return priceCents > 0;
}

export function canEnrolInGoldClass(input: {
  learnerId: string;
  tutorId: string;
  classStatus: GoldClassStatus;
  capacity: number;
  activeCount: number;
  existingStatus?: GoldEnrolmentStatus | null;
}): { ok: true } | { ok: false; reason: string } {
  if (input.learnerId === input.tutorId) {
    return { ok: false, reason: "You cannot enrol in your own class." };
  }
  if (input.classStatus !== "published") {
    return { ok: false, reason: "This class is not open for enrolment." };
  }
  if (input.existingStatus === "active") {
    return { ok: false, reason: "You are already enrolled in this class." };
  }
  if (input.existingStatus === "pending_payment") {
    return { ok: false, reason: "Finish or cancel the pending payment for this class first." };
  }
  if (input.activeCount >= input.capacity) {
    return { ok: false, reason: "This class is full." };
  }
  return { ok: true };
}

export function canStartGoldLesson(input: {
  tutorId: string;
  classTutorId: string;
  classStatus: GoldClassStatus;
  lessonStatus: GoldLessonStatus;
  startsAt: string;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.tutorId !== input.classTutorId) {
    return { ok: false, reason: "Only the class tutor can start this lesson." };
  }
  if (input.classStatus !== "published") {
    return { ok: false, reason: "This class is not active." };
  }
  if (input.lessonStatus === "ended" || input.lessonStatus === "cancelled") {
    return { ok: false, reason: "That lesson has already finished." };
  }
  const now = input.nowMs ?? Date.now();
  const start = Date.parse(input.startsAt);
  if (Number.isFinite(start) && now + 15 * 60_000 < start) {
    return { ok: false, reason: "This lesson cannot start more than 15 minutes early." };
  }
  return { ok: true };
}

export function canJoinGoldLesson(input: {
  userId: string;
  tutorId: string;
  lessonStatus: GoldLessonStatus;
  enrolmentStatus?: GoldEnrolmentStatus | null;
}): { ok: true; isHost: boolean } | { ok: false; reason: string } {
  if (input.lessonStatus === "cancelled") {
    return { ok: false, reason: "This lesson was cancelled." };
  }
  if (input.lessonStatus !== "live") {
    return { ok: false, reason: "This lesson is not live yet." };
  }
  if (input.userId === input.tutorId) return { ok: true, isHost: true };
  if (input.enrolmentStatus === "active") return { ok: true, isHost: false };
  return { ok: false, reason: "You are not enrolled in this class." };
}

export function canSubmitGoldReview(input: {
  learnerId: string;
  tutorId: string;
  enrolmentStatus?: GoldEnrolmentStatus | null;
  attended: boolean;
  alreadyReviewed: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.learnerId === input.tutorId) {
    return { ok: false, reason: "Tutors cannot review themselves." };
  }
  if (input.alreadyReviewed) {
    return { ok: false, reason: "You have already reviewed this class." };
  }
  if (input.enrolmentStatus !== "active" && input.enrolmentStatus !== "completed") {
    return { ok: false, reason: "Only enrolled learners can review." };
  }
  if (!input.attended) {
    return { ok: false, reason: "Join a live lesson before leaving a review." };
  }
  return { ok: true };
}

export function splitGoldEarnings(
  priceCents: number,
  commissionBps: number,
): {
  grossCents: number;
  commissionCents: number;
  tutorCents: number;
} {
  const bps = Math.min(9000, Math.max(0, Math.floor(commissionBps)));
  const commissionCents = Math.floor((priceCents * bps) / 10_000);
  return {
    grossCents: priceCents,
    commissionCents,
    tutorCents: priceCents - commissionCents,
  };
}

export function ratingAverage(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}
