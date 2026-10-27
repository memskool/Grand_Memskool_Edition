import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { GOLD_DELIVERY, GOLD_LEVELS, GOLD_SUBJECTS } from "./policy";

const optionalText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
});

const ApplySchema = z.object({
  bio: z.string().trim().min(40).max(2000),
  subjects: z.array(z.enum(GOLD_SUBJECTS)).min(1).max(8),
  levels: z.array(z.enum(GOLD_LEVELS)).min(1).max(6),
  languages: z.array(z.string().trim().min(1).max(40)).max(6).default(["English"]),
  curriculum: optionalText,
  qualifications: z.string().trim().min(8).max(2000),
  experienceYears: z.number().int().min(0).max(50),
  documentUrls: z.array(z.string().url().max(2048)).max(8).default([]),
  photoUrl: z.union([z.string().url().max(2048), z.null()]).optional(),
  delivery: z.array(z.enum(GOLD_DELIVERY)).min(1).max(3),
});

const ClassSchema = z.object({
  classId: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(4000),
  subject: z.enum(GOLD_SUBJECTS),
  topic: optionalText,
  level: z.enum(GOLD_LEVELS),
  curriculum: optionalText,
  objectives: z.string().trim().min(8).max(2000),
  language: z.string().trim().min(2).max(40).default("English"),
  delivery: z.enum(GOLD_DELIVERY),
  priceCents: z.number().int().min(0).max(50_000_000),
  currency: z.string().trim().min(3).max(8).default("UGX"),
  capacity: z.number().int().min(1).max(80),
  timezone: z.string().trim().min(3).max(64).default("Africa/Kampala"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  cancellationTerms: optionalText,
  publish: z.boolean().default(false),
});

export const loadGoldDirectory = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async () => {
    const { listDiscoverableGold, getGoldPolicyPublic } = await import("./gold.server");
    const [directory, policy] = await Promise.all([listDiscoverableGold(), getGoldPolicyPublic()]);
    return { ...directory, policy };
  });

export const loadMyGoldTutor = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { getMyGoldTutor } = await import("./gold.server");
    return getMyGoldTutor(context.userId);
  });

export const applyToTeachGold = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => ApplySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { applyGoldTutor } = await import("./gold.server");
    const profileName = context.email?.split("@")[0] ?? "Tutor";
    return applyGoldTutor({
      userId: context.userId,
      email: context.email,
      fullName: profileName,
      bio: data.bio,
      subjects: data.subjects,
      levels: data.levels,
      languages: data.languages,
      curriculum: data.curriculum,
      qualifications: data.qualifications,
      experienceYears: data.experienceYears,
      documentUrls: data.documentUrls,
      photoUrl: data.photoUrl ?? null,
      delivery: data.delivery,
    });
  });

export const reviewGoldTutorApplication = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tutorId: z.string().min(1),
        decision: z.enum(["approved", "rejected", "suspended"]),
        note: optionalText,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { reviewGoldApplication } = await import("./gold.server");
    return reviewGoldApplication({
      actorId: context.userId,
      actorRole: context.role,
      tutorId: data.tutorId,
      decision: data.decision,
      note: data.note,
    });
  });

export const listGoldTutorApplications = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    if (context.role !== "superadmin") throw new Error("Only platform operators can review Gold.");
    const { listGoldApplications } = await import("./gold.server");
    return listGoldApplications();
  });

export const saveGoldClass = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => ClassSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { upsertGoldClass } = await import("./gold.server");
    return upsertGoldClass({
      userId: context.userId,
      classId: data.classId ?? null,
      title: data.title,
      description: data.description,
      subject: data.subject,
      topic: data.topic,
      level: data.level,
      curriculum: data.curriculum,
      objectives: data.objectives,
      language: data.language,
      delivery: data.delivery,
      priceCents: data.priceCents,
      currency: data.currency,
      capacity: data.capacity,
      timezone: data.timezone,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      cancellationTerms: data.cancellationTerms,
      publish: data.publish,
    });
  });

export const listMyGoldClasses = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { listTutorGoldClasses } = await import("./gold.server");
    return listTutorGoldClasses(context.userId);
  });

export const loadGoldTutorProfile = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ tutorId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { getGoldTutorPublic, listTutorGoldClasses, listGoldReviews } =
      await import("./gold.server");
    const tutor = await getGoldTutorPublic(data.tutorId);
    if (!tutor) return null;
    const [classes, reviews] = await Promise.all([
      listTutorGoldClasses(data.tutorId),
      listGoldReviews(data.tutorId),
    ]);
    return {
      tutor,
      classes: classes.filter((row) => row.status === "published"),
      reviews,
    };
  });

export const loadGoldClassPage = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ classId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadGoldClassBundle } = await import("./gold.server");
    return loadGoldClassBundle(data.classId, context.userId);
  });

export const enrolGoldClass = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ classId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { enrolInGoldClass } = await import("./gold.server");
    const origin = new URL(getRequest().url).origin;
    return enrolInGoldClass({
      userId: context.userId,
      email: context.email,
      classId: data.classId,
      origin,
    });
  });

export const loadMyGoldEnrolments = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { listMyGoldEnrolments } = await import("./gold.server");
    return listMyGoldEnrolments(context.userId);
  });

export const loadGoldClassEnrolments = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ classId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { listClassEnrolments } = await import("./gold.server");
    return listClassEnrolments(data.classId, context.userId);
  });

export const scheduleGoldClassLesson = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        classId: z.string().min(1),
        title: z.string().trim().min(2).max(160),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { scheduleGoldLesson } = await import("./gold.server");
    return scheduleGoldLesson({
      userId: context.userId,
      classId: data.classId,
      title: data.title,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    });
  });

export const startGoldClassLesson = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ lessonId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { startGoldLesson } = await import("./gold.server");
    return startGoldLesson({ userId: context.userId, lessonId: data.lessonId });
  });

export const endGoldClassLesson = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ lessonId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { endGoldLesson } = await import("./gold.server");
    await endGoldLesson({ userId: context.userId, lessonId: data.lessonId });
    return { ok: true as const };
  });

export const addGoldClassResource = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        classId: z.string().min(1),
        title: z.string().trim().min(2).max(160),
        storagePath: optionalText,
        url: optionalText,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addGoldResource } = await import("./gold.server");
    return addGoldResource({
      userId: context.userId,
      classId: data.classId,
      title: data.title,
      storagePath: data.storagePath,
      url: data.url,
    });
  });

export const copyGoldResourceLocker = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ resourceId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { copyGoldResourceToLocker } = await import("./gold.server");
    await copyGoldResourceToLocker({ userId: context.userId, resourceId: data.resourceId });
    return { ok: true as const };
  });

export const submitGoldClassReview = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        classId: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        body: optionalText,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { submitGoldReview } = await import("./gold.server");
    return submitGoldReview({
      userId: context.userId,
      classId: data.classId,
      rating: data.rating,
      body: data.body,
    });
  });

export const reportGoldClassReview = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ reviewId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { reportGoldReview } = await import("./gold.server");
    await reportGoldReview({ userId: context.userId, reviewId: data.reviewId });
    return { ok: true as const };
  });

export const setGoldPlatformCommission = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ commissionBps: z.number().int().min(0).max(5000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { setGoldCommission } = await import("./gold.server");
    return setGoldCommission({
      actorRole: context.role,
      actorId: context.userId,
      commissionBps: data.commissionBps,
    });
  });
