import "@tanstack/react-start/server-only";
import {
  adminCreate,
  adminGetById,
  adminIsSuspended,
  adminSet,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { providerRoomName } from "@/features/live-classroom/contracts";
import { createAndQueueNotification, dispatchNotifications } from "@/lib/notifications.server";
import {
  DEFAULT_GOLD_COMMISSION_BPS,
  GOLD_DELIVERY,
  GOLD_LEVELS,
  GOLD_SUBJECTS,
  canApplyAsGoldTutor,
  canEnrolInGoldClass,
  canJoinGoldLesson,
  canPublishGoldClass,
  canStartGoldLesson,
  canSubmitGoldReview,
  enrolmentRequiresPayment,
  goldEnrolmentId,
  goldReviewId,
  isApprovedGoldTutor,
  splitGoldEarnings,
  type GoldApplicationStatus,
  type GoldClassStatus,
  type GoldDelivery,
  type GoldLevel,
  type GoldSubject,
} from "./policy";
import type {
  GoldClass,
  GoldEnrolment,
  GoldLesson,
  GoldPolicy,
  GoldResource,
  GoldReview,
  GoldTutor,
} from "./types";
import {
  forgetGoldClass,
  forgetGoldTutor,
  loadGoldCatalog,
  loadGoldClassesByIds,
  loadGoldTutorsByIds,
  rememberGoldClass,
  rememberGoldTutor,
} from "./catalog.server";

async function writeAudit(input: {
  type: string;
  actorId: string;
  summary: string;
  targetId?: string | null;
}) {
  await adminCreate(COLLECTIONS.auditLogs, {
    type: input.type,
    actor_id: input.actorId,
    school_id: null,
    target_id: input.targetId ?? null,
    summary: input.summary,
    created_at: new Date().toISOString(),
  });
}

async function loadPolicy(): Promise<GoldPolicy> {
  const row = await adminGetById<GoldPolicy>("ops", "gold_policy");
  return {
    commission_bps: row?.commission_bps ?? DEFAULT_GOLD_COMMISSION_BPS,
    updated_at: row?.updated_at ?? new Date().toISOString(),
  };
}

function asSubject(value: string): GoldSubject {
  return (GOLD_SUBJECTS as readonly string[]).includes(value) ? (value as GoldSubject) : "other";
}

export async function getMyGoldTutor(userId: string): Promise<GoldTutor | null> {
  return adminGetById<GoldTutor>(COLLECTIONS.goldTutors, userId);
}

export async function applyGoldTutor(input: {
  userId: string;
  email: string | null;
  fullName: string;
  bio: string;
  subjects: string[];
  levels: string[];
  languages: string[];
  curriculum: string | null;
  qualifications: string;
  experienceYears: number;
  documentUrls: string[];
  photoUrl: string | null;
  delivery: string[];
}): Promise<GoldTutor> {
  if (await adminIsSuspended(input.userId)) {
    throw new Error("Your account is suspended.");
  }
  const existing = await getMyGoldTutor(input.userId);
  const account = await adminGetById<{ role?: string }>(COLLECTIONS.users, input.userId);
  const gate = canApplyAsGoldTutor({
    alreadyStatus: existing?.status ?? null,
    role: account?.role ?? null,
  });
  if (!gate.ok) throw new Error(gate.reason);
  if (!input.bio.trim() || input.bio.trim().length < 40) {
    throw new Error("Write a short professional biography (at least 40 characters).");
  }
  if (!input.qualifications.trim()) throw new Error("List your qualifications.");
  if (input.subjects.length < 1) throw new Error("Choose at least one subject.");

  const now = new Date().toISOString();
  const profile = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, input.userId);
  const tutor: Omit<GoldTutor, "id"> = {
    user_id: input.userId,
    full_name: (profile?.full_name || input.fullName || "Tutor").trim(),
    bio: input.bio.trim(),
    subjects: input.subjects.map(asSubject).slice(0, 8),
    levels: input.levels
      .filter((level): level is GoldLevel => (GOLD_LEVELS as readonly string[]).includes(level))
      .slice(0, 6),
    languages: input.languages
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6),
    curriculum: input.curriculum?.trim() || null,
    qualifications: input.qualifications.trim().slice(0, 2000),
    experience_years: Math.min(50, Math.max(0, Math.floor(input.experienceYears))),
    document_urls: input.documentUrls.filter(Boolean).slice(0, 8),
    photo_url: input.photoUrl,
    delivery: input.delivery.filter((d): d is GoldDelivery =>
      (GOLD_DELIVERY as readonly string[]).includes(d),
    ),
    status: existing?.status === "rejected" ? "pending" : "pending",
    review_note: null,
    rating_sum: existing?.rating_sum ?? 0,
    rating_count: existing?.rating_count ?? 0,
    earnings_pending_cents: existing?.earnings_pending_cents ?? 0,
    earnings_currency: existing?.earnings_currency ?? "UGX",
    created_at: existing?.created_at ?? now,
    updated_at: now,
    decided_at: null,
  };
  await adminSet(COLLECTIONS.goldTutors, input.userId, tutor);
  await writeAudit({
    type: "gold_application",
    actorId: input.userId,
    targetId: input.userId,
    summary: "Gold tutor application submitted",
  });
  return { id: input.userId, ...tutor };
}

export async function reviewGoldApplication(input: {
  actorId: string;
  actorRole: string;
  tutorId: string;
  decision: "approved" | "rejected" | "suspended";
  note: string | null;
}): Promise<GoldTutor> {
  if (input.actorRole !== "superadmin") {
    throw new Error("Only platform operators can review Gold tutors.");
  }
  const tutor = await getMyGoldTutor(input.tutorId);
  if (!tutor) throw new Error("That application was not found.");
  const now = new Date().toISOString();
  await adminUpdate(COLLECTIONS.goldTutors, input.tutorId, {
    status: input.decision,
    review_note: input.note?.trim() || null,
    decided_at: now,
    updated_at: now,
  });
  if (input.decision === "approved") await rememberGoldTutor(input.tutorId);
  else await forgetGoldTutor(input.tutorId);
  if (input.decision === "suspended") {
    const classes = await adminWhere<GoldClass>(
      COLLECTIONS.goldClasses,
      "tutor_id",
      "==",
      input.tutorId,
    );
    for (const cls of classes) {
      if (cls.status === "published") {
        await adminUpdate(COLLECTIONS.goldClasses, cls.id, {
          status: "cancelled",
          updated_at: now,
        });
        await forgetGoldClass(cls.id);
      }
    }
  }
  await createAndQueueNotification({
    userId: input.tutorId,
    title:
      input.decision === "approved"
        ? "Gold tutor application approved"
        : input.decision === "suspended"
          ? "Your Gold tutor account was suspended"
          : "Gold tutor application was not approved",
    body:
      input.note?.trim() ||
      (input.decision === "approved"
        ? "You can now publish tutoring classes on Gold."
        : "Open Gold for details."),
    kind: "gold",
    link: "/gold",
  });
  void dispatchNotifications();
  await writeAudit({
    type: "gold_review",
    actorId: input.actorId,
    targetId: input.tutorId,
    summary: `Gold tutor ${input.decision}`,
  });
  const next = await getMyGoldTutor(input.tutorId);
  if (!next) throw new Error("Could not load the updated tutor.");
  return next;
}

export async function listGoldApplications(): Promise<GoldTutor[]> {
  const { adminListAll } = await import("@/lib/firebase/admin-repo");
  try {
    const pending = await adminWhere<GoldTutor>(COLLECTIONS.goldTutors, "status", "==", "pending");
    const approved = await adminWhere<GoldTutor>(
      COLLECTIONS.goldTutors,
      "status",
      "==",
      "approved",
    );
    const suspended = await adminWhere<GoldTutor>(
      COLLECTIONS.goldTutors,
      "status",
      "==",
      "suspended",
    );
    return [...pending, ...approved, ...suspended].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  } catch {
    return (await adminListAll<GoldTutor>(COLLECTIONS.goldTutors, 80)).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }
}

export async function listDiscoverableGold(): Promise<{
  tutors: GoldTutor[];
  classes: GoldClass[];
}> {
  const catalog = await loadGoldCatalog();
  const [tutors, classes] = await Promise.all([
    loadGoldTutorsByIds(catalog.tutorIds),
    loadGoldClassesByIds(catalog.classIds),
  ]);
  return { tutors, classes };
}

export async function upsertGoldClass(input: {
  userId: string;
  classId?: string | null;
  title: string;
  description: string;
  subject: string;
  topic: string | null;
  level: string;
  curriculum: string | null;
  objectives: string;
  language: string;
  delivery: string;
  priceCents: number;
  currency: string;
  capacity: number;
  timezone: string;
  startsAt: string;
  endsAt: string;
  cancellationTerms: string | null;
  publish: boolean;
}): Promise<GoldClass> {
  const tutor = await getMyGoldTutor(input.userId);
  if (!isApprovedGoldTutor(tutor?.status)) {
    throw new Error("Only approved Gold tutors can manage classes.");
  }
  const now = new Date().toISOString();
  let existing: GoldClass | null = null;
  if (input.classId) {
    existing = await adminGetById<GoldClass>(COLLECTIONS.goldClasses, input.classId);
    if (!existing || existing.tutor_id !== input.userId) {
      throw new Error("That class was not found.");
    }
  }
  const draft: Omit<GoldClass, "id"> = {
    tutor_id: input.userId,
    tutor_name: tutor!.full_name,
    title: input.title.trim(),
    description: input.description.trim(),
    subject: asSubject(input.subject),
    topic: input.topic?.trim() || null,
    level: (GOLD_LEVELS as readonly string[]).includes(input.level)
      ? (input.level as GoldLevel)
      : "upper_secondary",
    curriculum: input.curriculum?.trim() || null,
    objectives: input.objectives.trim(),
    language: input.language.trim() || "English",
    delivery: (GOLD_DELIVERY as readonly string[]).includes(input.delivery)
      ? (input.delivery as GoldDelivery)
      : "live",
    price_cents: Math.max(0, Math.floor(input.priceCents)),
    currency: (input.currency || "UGX").toUpperCase(),
    capacity: input.capacity,
    enrolled_count: existing?.enrolled_count ?? 0,
    timezone: input.timezone.trim() || "Africa/Kampala",
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status:
      existing?.status === "published" && !input.publish ? "draft" : (existing?.status ?? "draft"),
    cancellation_terms: input.cancellationTerms?.trim() || null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  if (input.publish) {
    const gate = canPublishGoldClass({
      tutorStatus: tutor!.status,
      tutorId: input.userId,
      classTutorId: draft.tutor_id,
      status: draft.status,
      title: draft.title,
      startsAt: draft.starts_at,
      endsAt: draft.ends_at,
      capacity: draft.capacity,
      priceCents: draft.price_cents,
    });
    if (!gate.ok) throw new Error(gate.reason);
    draft.status = "published";
  }
  const classId = existing?.id ?? (await adminCreate(COLLECTIONS.goldClasses, draft));
  if (existing) await adminUpdate(COLLECTIONS.goldClasses, classId, draft);
  if (draft.status === "published") await rememberGoldClass(classId);
  else await forgetGoldClass(classId);
  return { id: classId, ...draft };
}

export async function listTutorGoldClasses(tutorId: string): Promise<GoldClass[]> {
  return adminWhere<GoldClass>(COLLECTIONS.goldClasses, "tutor_id", "==", tutorId);
}

export async function getGoldClass(classId: string): Promise<GoldClass | null> {
  return adminGetById<GoldClass>(COLLECTIONS.goldClasses, classId);
}

export async function getGoldTutorPublic(tutorId: string): Promise<GoldTutor | null> {
  const tutor = await getMyGoldTutor(tutorId);
  if (!tutor || tutor.status !== "approved") return null;
  return tutor;
}

async function countActiveEnrolments(classId: string): Promise<number> {
  const rows = await adminWhere<GoldEnrolment>(
    COLLECTIONS.goldEnrolments,
    "class_id",
    "==",
    classId,
  );
  return rows.filter((row) => row.status === "active").length;
}

export async function enrolInGoldClass(input: {
  userId: string;
  email: string | null;
  classId: string;
  origin: string;
}): Promise<{ enrolment: GoldEnrolment; paymentLink: string | null; reference: string | null }> {
  if (await adminIsSuspended(input.userId)) {
    throw new Error("Your account is suspended.");
  }
  const cls = await getGoldClass(input.classId);
  if (!cls) throw new Error("That class was not found.");
  const enrolmentId = goldEnrolmentId(cls.id, input.userId);
  const existing = await adminGetById<GoldEnrolment>(COLLECTIONS.goldEnrolments, enrolmentId);
  const activeCount = await countActiveEnrolments(cls.id);
  const gate = canEnrolInGoldClass({
    learnerId: input.userId,
    tutorId: cls.tutor_id,
    classStatus: cls.status,
    capacity: cls.capacity,
    activeCount,
    existingStatus: existing?.status ?? null,
  });
  if (!gate.ok) throw new Error(gate.reason);

  const now = new Date().toISOString();
  if (!enrolmentRequiresPayment(cls.price_cents)) {
    const enrolment: Omit<GoldEnrolment, "id"> = {
      class_id: cls.id,
      tutor_id: cls.tutor_id,
      learner_id: input.userId,
      status: "active",
      price_cents: 0,
      currency: cls.currency,
      order_id: null,
      attended: false,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    await adminSet(COLLECTIONS.goldEnrolments, enrolmentId, enrolment);
    await adminUpdate(COLLECTIONS.goldClasses, cls.id, {
      enrolled_count: activeCount + 1,
      updated_at: now,
    });
    await notifyEnrolment(cls, input.userId, true);
    return { enrolment: { id: enrolmentId, ...enrolment }, paymentLink: null, reference: null };
  }

  const { requireFlutterwaveSecret, buildReference, createFlutterwaveCheckout, toProviderAmount } =
    await import("@/lib/payments.server");
  requireFlutterwaveSecret();
  const profile = await adminGetById<{ full_name: string; email: string | null }>(
    COLLECTIONS.users,
    input.userId,
  );
  const email = profile?.email ?? input.email;
  if (!email) throw new Error("Add an email address to your profile before paying.");

  const reference = buildReference();
  const orderId = await adminCreate(COLLECTIONS.orders, {
    buyer_id: input.userId,
    item_id: cls.id,
    item_title: cls.title,
    item_kind: "gold_class",
    gold_class_id: cls.id,
    gold_tutor_id: cls.tutor_id,
    quantity: 1,
    amount_cents: cls.price_cents,
    currency: cls.currency,
    status: "pending",
    provider: "flutterwave",
    reference,
    scheduled_at: cls.starts_at,
    notes: null,
    created_at: now,
  });

  const paymentLink = await createFlutterwaveCheckout({
    reference,
    amount: toProviderAmount(cls.price_cents, cls.currency),
    currency: cls.currency,
    email,
    name: profile?.full_name || "Memskool learner",
    title: cls.title,
    redirectUrl: `${input.origin}/gold/class/${cls.id}?ref=${reference}`,
  });
  await adminUpdate(COLLECTIONS.orders, orderId, { payment_link: paymentLink });

  const enrolment: Omit<GoldEnrolment, "id"> = {
    class_id: cls.id,
    tutor_id: cls.tutor_id,
    learner_id: input.userId,
    status: "pending_payment",
    price_cents: cls.price_cents,
    currency: cls.currency,
    order_id: orderId,
    attended: false,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await adminSet(COLLECTIONS.goldEnrolments, enrolmentId, enrolment);
  return {
    enrolment: { id: enrolmentId, ...enrolment },
    paymentLink,
    reference,
  };
}

export async function fulfillGoldEnrolmentFromOrder(input: {
  buyerId: string;
  classId: string;
  orderId: string;
  amountCents: number;
}): Promise<void> {
  const cls = await getGoldClass(input.classId);
  if (!cls) return;
  const enrolmentId = goldEnrolmentId(cls.id, input.buyerId);
  const existing = await adminGetById<GoldEnrolment>(COLLECTIONS.goldEnrolments, enrolmentId);
  if (existing?.status === "active") return;
  const now = new Date().toISOString();
  const activeCount = await countActiveEnrolments(cls.id);
  if (activeCount >= cls.capacity && existing?.status !== "pending_payment") return;

  await adminSet(COLLECTIONS.goldEnrolments, enrolmentId, {
    class_id: cls.id,
    tutor_id: cls.tutor_id,
    learner_id: input.buyerId,
    status: "active",
    price_cents: input.amountCents,
    currency: cls.currency,
    order_id: input.orderId,
    attended: existing?.attended ?? false,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });
  await adminUpdate(COLLECTIONS.goldClasses, cls.id, {
    enrolled_count: activeCount + 1,
    updated_at: now,
  });
  const policy = await loadPolicy();
  const split = splitGoldEarnings(input.amountCents, policy.commission_bps);
  const tutor = await getMyGoldTutor(cls.tutor_id);
  if (tutor) {
    await adminUpdate(COLLECTIONS.goldTutors, cls.tutor_id, {
      earnings_pending_cents: (tutor.earnings_pending_cents ?? 0) + split.tutorCents,
      earnings_currency: cls.currency,
      updated_at: now,
    });
  }
  await notifyEnrolment(cls, input.buyerId, true);
}

async function notifyEnrolment(cls: GoldClass, learnerId: string, success: boolean) {
  await createAndQueueNotification({
    userId: learnerId,
    title: success ? "Gold enrolment confirmed" : "Gold enrolment pending",
    body: success
      ? `You are enrolled in ${cls.title}. Open Gold for the schedule.`
      : `Finish payment to join ${cls.title}.`,
    kind: "gold",
    link: `/gold/class/${cls.id}`,
  });
  await createAndQueueNotification({
    userId: cls.tutor_id,
    title: "New Gold enrolment",
    body: `A learner enrolled in ${cls.title}.`,
    kind: "gold",
    link: "/gold",
  });
  void dispatchNotifications();
}

export async function listMyGoldEnrolments(userId: string): Promise<GoldEnrolment[]> {
  return adminWhere<GoldEnrolment>(COLLECTIONS.goldEnrolments, "learner_id", "==", userId);
}

export async function listClassEnrolments(
  classId: string,
  tutorId: string,
): Promise<GoldEnrolment[]> {
  const cls = await getGoldClass(classId);
  if (!cls || cls.tutor_id !== tutorId) throw new Error("That class was not found.");
  return adminWhere<GoldEnrolment>(COLLECTIONS.goldEnrolments, "class_id", "==", classId);
}

export async function scheduleGoldLesson(input: {
  userId: string;
  classId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}): Promise<GoldLesson> {
  const cls = await getGoldClass(input.classId);
  if (!cls || cls.tutor_id !== input.userId) throw new Error("That class was not found.");
  if (cls.status !== "published") throw new Error("Publish the class before scheduling lessons.");
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("The lesson schedule is invalid.");
  }
  const now = new Date().toISOString();
  const lesson: Omit<GoldLesson, "id"> = {
    class_id: cls.id,
    tutor_id: input.userId,
    title: input.title.trim() || cls.title,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status: "scheduled",
    classroom_session_id: null,
    created_at: now,
    updated_at: now,
  };
  const id = await adminCreate(COLLECTIONS.goldLessons, lesson);
  const learners = await adminWhere<GoldEnrolment>(
    COLLECTIONS.goldEnrolments,
    "class_id",
    "==",
    cls.id,
  );
  for (const row of learners.filter((item) => item.status === "active")) {
    await createAndQueueNotification({
      userId: row.learner_id,
      title: "Gold lesson scheduled",
      body: `${lesson.title} is scheduled. Open Gold for the time.`,
      kind: "gold",
      link: `/gold/class/${cls.id}`,
    });
  }
  void dispatchNotifications();
  return { id, ...lesson };
}

export async function listGoldLessons(classId: string): Promise<GoldLesson[]> {
  return adminWhere<GoldLesson>(COLLECTIONS.goldLessons, "class_id", "==", classId);
}

export async function startGoldLesson(input: {
  userId: string;
  lessonId: string;
}): Promise<{ lesson: GoldLesson; sessionId: string }> {
  const lesson = await adminGetById<GoldLesson>(COLLECTIONS.goldLessons, input.lessonId);
  if (!lesson) throw new Error("That lesson was not found.");
  const cls = await getGoldClass(lesson.class_id);
  if (!cls) throw new Error("That class was not found.");
  const gate = canStartGoldLesson({
    tutorId: input.userId,
    classTutorId: cls.tutor_id,
    classStatus: cls.status,
    lessonStatus: lesson.status,
    startsAt: lesson.starts_at,
  });
  if (!gate.ok) throw new Error(gate.reason);
  const now = new Date().toISOString();
  let sessionId = lesson.classroom_session_id;
  if (!sessionId) {
    sessionId = await adminCreate(COLLECTIONS.classroomSessions, {
      school_id: null,
      class_id: cls.id,
      host_id: cls.tutor_id,
      lesson_id: lesson.id,
      title: lesson.title,
      status: "live",
      is_active: true,
      kind: "gold",
      gold_class_id: cls.id,
      gold_tutor_id: cls.tutor_id,
      provider: "livekit",
      provider_room: null,
      started_at: now,
      ended_at: null,
      created_at: now,
    });
    await adminUpdate(COLLECTIONS.classroomSessions, sessionId, {
      provider_room: providerRoomName(sessionId),
    });
  } else {
    await adminUpdate(COLLECTIONS.classroomSessions, sessionId, {
      status: "live",
      is_active: true,
      started_at: now,
      ended_at: null,
    });
  }
  await adminUpdate(COLLECTIONS.goldLessons, lesson.id, {
    status: "live",
    classroom_session_id: sessionId,
    updated_at: now,
  });
  const learners = await adminWhere<GoldEnrolment>(
    COLLECTIONS.goldEnrolments,
    "class_id",
    "==",
    cls.id,
  );
  for (const row of learners.filter((item) => item.status === "active")) {
    await createAndQueueNotification({
      userId: row.learner_id,
      title: "Gold lesson is live",
      body: `${lesson.title} has started. Join from Gold.`,
      kind: "gold",
      link: `/gold/class/${cls.id}`,
    });
  }
  void dispatchNotifications();
  return {
    lesson: { ...lesson, status: "live", classroom_session_id: sessionId, updated_at: now },
    sessionId,
  };
}

export async function endGoldLesson(input: { userId: string; lessonId: string }): Promise<void> {
  const lesson = await adminGetById<GoldLesson>(COLLECTIONS.goldLessons, input.lessonId);
  if (!lesson || lesson.tutor_id !== input.userId) throw new Error("That lesson was not found.");
  const now = new Date().toISOString();
  await adminUpdate(COLLECTIONS.goldLessons, lesson.id, { status: "ended", updated_at: now });
  if (lesson.classroom_session_id) {
    await adminUpdate(COLLECTIONS.classroomSessions, lesson.classroom_session_id, {
      status: "ended",
      is_active: false,
      ended_at: now,
    });
  }
}

export async function assertGoldSessionJoin(
  userId: string,
  session: {
    kind?: string | null;
    gold_class_id?: string | null;
    gold_tutor_id?: string | null;
    host_id: string;
    status?: string;
    is_active?: boolean;
  },
): Promise<{ isHost: boolean; canPublish: boolean }> {
  const classId = session.gold_class_id;
  const tutorId = session.gold_tutor_id || session.host_id;
  if (!classId) throw new Error("You are not allowed to join this class.");
  const enrolment = await adminGetById<GoldEnrolment>(
    COLLECTIONS.goldEnrolments,
    goldEnrolmentId(classId, userId),
  );
  const lessonLive = session.status === "live" && session.is_active !== false;
  const gate = canJoinGoldLesson({
    userId,
    tutorId,
    lessonStatus: lessonLive ? "live" : "scheduled",
    enrolmentStatus: enrolment?.status ?? null,
  });
  if (!gate.ok) throw new Error(gate.reason);
  if (enrolment && !enrolment.attended && !gate.isHost) {
    await adminUpdate(COLLECTIONS.goldEnrolments, enrolment.id, {
      attended: true,
      updated_at: new Date().toISOString(),
    });
  }
  return { isHost: gate.isHost, canPublish: true };
}

export async function addGoldResource(input: {
  userId: string;
  classId: string;
  title: string;
  storagePath: string | null;
  url: string | null;
}): Promise<GoldResource> {
  const cls = await getGoldClass(input.classId);
  if (!cls || cls.tutor_id !== input.userId) throw new Error("That class was not found.");
  if (!input.title.trim()) throw new Error("Give the resource a title.");
  const now = new Date().toISOString();
  const resource: Omit<GoldResource, "id"> = {
    class_id: cls.id,
    tutor_id: input.userId,
    title: input.title.trim(),
    storage_path: input.storagePath,
    url: input.url,
    created_at: now,
  };
  const id = await adminCreate(COLLECTIONS.goldResources, resource);
  const learners = await adminWhere<GoldEnrolment>(
    COLLECTIONS.goldEnrolments,
    "class_id",
    "==",
    cls.id,
  );
  for (const row of learners.filter((item) => item.status === "active")) {
    await createAndQueueNotification({
      userId: row.learner_id,
      title: "New Gold class material",
      body: `${resource.title} was added to ${cls.title}.`,
      kind: "gold",
      link: `/gold/class/${cls.id}`,
    });
  }
  void dispatchNotifications();
  return { id, ...resource };
}

export async function listGoldResources(classId: string, userId: string): Promise<GoldResource[]> {
  const cls = await getGoldClass(classId);
  if (!cls) return [];
  if (cls.tutor_id !== userId) {
    const enrolment = await adminGetById<GoldEnrolment>(
      COLLECTIONS.goldEnrolments,
      goldEnrolmentId(classId, userId),
    );
    if (enrolment?.status !== "active" && enrolment?.status !== "completed") {
      throw new Error("Enrol to access these materials.");
    }
  }
  return adminWhere<GoldResource>(COLLECTIONS.goldResources, "class_id", "==", classId);
}

export async function copyGoldResourceToLocker(input: {
  userId: string;
  resourceId: string;
}): Promise<void> {
  const resource = await adminGetById<GoldResource>(COLLECTIONS.goldResources, input.resourceId);
  if (!resource) throw new Error("That resource was not found.");
  await listGoldResources(resource.class_id, input.userId);
  const now = new Date().toISOString();
  await adminCreate(COLLECTIONS.lockerItems, {
    owner_id: input.userId,
    title: resource.title,
    kind: "file",
    url: resource.url,
    storage_path: resource.storage_path,
    from_gold: true,
    gold_class_id: resource.class_id,
    created_at: now,
  });
}

export async function submitGoldReview(input: {
  userId: string;
  classId: string;
  rating: number;
  body: string | null;
}): Promise<GoldReview> {
  const cls = await getGoldClass(input.classId);
  if (!cls) throw new Error("That class was not found.");
  const enrolment = await adminGetById<GoldEnrolment>(
    COLLECTIONS.goldEnrolments,
    goldEnrolmentId(cls.id, input.userId),
  );
  const reviewId = goldReviewId(cls.id, input.userId);
  const existing = await adminGetById<GoldReview>(COLLECTIONS.goldReviews, reviewId);
  const gate = canSubmitGoldReview({
    learnerId: input.userId,
    tutorId: cls.tutor_id,
    enrolmentStatus: enrolment?.status ?? null,
    attended: Boolean(enrolment?.attended),
    alreadyReviewed: Boolean(existing),
  });
  if (!gate.ok) throw new Error(gate.reason);
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const now = new Date().toISOString();
  const review: Omit<GoldReview, "id"> = {
    class_id: cls.id,
    tutor_id: cls.tutor_id,
    learner_id: input.userId,
    rating,
    body: input.body?.trim() || null,
    reported: false,
    created_at: now,
  };
  await adminSet(COLLECTIONS.goldReviews, reviewId, review);
  const tutor = await getMyGoldTutor(cls.tutor_id);
  if (tutor) {
    await adminUpdate(COLLECTIONS.goldTutors, cls.tutor_id, {
      rating_sum: (tutor.rating_sum ?? 0) + rating,
      rating_count: (tutor.rating_count ?? 0) + 1,
      updated_at: now,
    });
  }
  return { id: reviewId, ...review };
}

export async function listGoldReviews(tutorId: string): Promise<GoldReview[]> {
  return adminWhere<GoldReview>(COLLECTIONS.goldReviews, "tutor_id", "==", tutorId);
}

export async function reportGoldReview(input: { userId: string; reviewId: string }): Promise<void> {
  const review = await adminGetById<GoldReview>(COLLECTIONS.goldReviews, input.reviewId);
  if (!review) throw new Error("That review was not found.");
  await adminUpdate(COLLECTIONS.goldReviews, input.reviewId, { reported: true });
  await writeAudit({
    type: "gold_review_report",
    actorId: input.userId,
    targetId: input.reviewId,
    summary: "Gold review reported",
  });
}

export async function setGoldCommission(input: {
  actorRole: string;
  actorId: string;
  commissionBps: number;
}): Promise<GoldPolicy> {
  if (input.actorRole !== "superadmin") {
    throw new Error("Only platform operators can change Gold commission.");
  }
  const bps = Math.min(5000, Math.max(0, Math.floor(input.commissionBps)));
  const policy: GoldPolicy = { commission_bps: bps, updated_at: new Date().toISOString() };
  await adminSet("ops", "gold_policy", policy);
  await writeAudit({
    type: "gold_policy",
    actorId: input.actorId,
    summary: `Gold commission set to ${bps} bps`,
  });
  return policy;
}

export async function getGoldPolicyPublic(): Promise<GoldPolicy> {
  return loadPolicy();
}

export async function loadGoldClassBundle(classId: string, userId: string) {
  const cls = await getGoldClass(classId);
  if (!cls) return null;
  const tutor = await getGoldTutorPublic(cls.tutor_id);
  const enrolment = await adminGetById<GoldEnrolment>(
    COLLECTIONS.goldEnrolments,
    goldEnrolmentId(classId, userId),
  );
  const lessons = await listGoldLessons(classId);
  const reviews = await listGoldReviews(cls.tutor_id);
  let resources: GoldResource[] = [];
  try {
    resources = await listGoldResources(classId, userId);
  } catch {
    resources = [];
  }
  return { class: cls, tutor, enrolment, lessons, reviews, resources };
}
