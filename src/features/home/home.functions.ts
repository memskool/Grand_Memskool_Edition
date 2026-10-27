import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalFirebaseAuth, requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { HOME_LEVELS, HOME_REPORT_REASONS, HOME_SUBJECTS } from "./policy";

const optionalText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
});

const FeedSchema = z.object({
  query: z.string().trim().max(120).optional(),
  subject: z.union([z.enum(HOME_SUBJECTS), z.literal("all")]).optional(),
  level: z.union([z.enum(HOME_LEVELS), z.literal("all")]).optional(),
  cursor: z.union([z.string(), z.null()]).optional(),
});

const DraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(12).max(2000),
  subject: z.enum(HOME_SUBJECTS),
  topic: optionalText,
  level: z.enum(HOME_LEVELS),
  curriculum: optionalText,
  language: z.string().trim().min(2).max(40).default("English"),
  durationSeconds: z.number().int().min(5).max(180),
  publishAsSchool: z.boolean().default(false),
});

const SubmitSchema = DraftSchema.extend({
  videoId: z.string().min(1),
  rightsConfirmed: z.boolean(),
  noIdentifiableStudents: z.boolean(),
  hasCaption: z.boolean().default(false),
  hasThumbnail: z.boolean().default(false),
});

export const loadHomeFeed = createServerFn({ method: "POST" })
  .middleware([optionalFirebaseAuth])
  .inputValidator((data: unknown) => FeedSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { loadHomeFeed: load } = await import("./home.server");
    return load({
      userId: context?.userId ?? null,
      subject: data.subject === "all" ? null : (data.subject ?? null),
      level: data.level === "all" ? null : (data.level ?? null),
      cursor: data.cursor ?? null,
      ...(data.query ? { query: data.query } : {}),
    });
  });

export const loadHomeVideoPage = createServerFn({ method: "POST" })
  .middleware([optionalFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ videoId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadHomeVideoPage: load } = await import("./home.server");
    return load(data.videoId, context?.userId ?? null);
  });

export const loadHomeSchoolChannel = createServerFn({ method: "POST" })
  .middleware([optionalFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ schoolId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadHomeSchoolChannel: load } = await import("./home.server");
    return load(data.schoolId, context?.userId ?? null);
  });

export const loadHomeCreatorChannel = createServerFn({ method: "POST" })
  .middleware([optionalFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ creatorId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadHomeCreatorChannel: load } = await import("./home.server");
    return load(data.creatorId, context?.userId ?? null);
  });

export const listMyHomeVideos = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { listMyHomeVideos: load } = await import("./home.server");
    return load(context.userId);
  });

export const createHomeDraft = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => DraftSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { createHomeDraft: create } = await import("./home.server");
    return create({
      actor: context,
      title: data.title,
      description: data.description,
      subject: data.subject,
      topic: data.topic,
      level: data.level,
      curriculum: data.curriculum,
      language: data.language,
      durationSeconds: data.durationSeconds,
      publishAsSchool: data.publishAsSchool,
    });
  });

export const submitHomeDraft = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SubmitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { submitHomeDraft: submit } = await import("./home.server");
    return submit({
      actor: context,
      videoId: data.videoId,
      title: data.title,
      description: data.description,
      subject: data.subject,
      topic: data.topic,
      level: data.level,
      curriculum: data.curriculum,
      language: data.language,
      durationSeconds: data.durationSeconds,
      rightsConfirmed: data.rightsConfirmed,
      noIdentifiableStudents: data.noIdentifiableStudents,
      hasCaption: data.hasCaption,
      hasThumbnail: data.hasThumbnail,
    });
  });

export const moderateHomeVideo = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        videoId: z.string().min(1),
        decision: z.enum(["approve", "reject", "remove"]),
        note: optionalText,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { moderateHomeVideo: run } = await import("./home.server");
    await run({
      actor: context,
      videoId: data.videoId,
      decision: data.decision,
      note: data.note,
    });
    return { ok: true };
  });

export const unpublishHomeVideo = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ videoId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { unpublishOwnHomeVideo } = await import("./home.server");
    await unpublishOwnHomeVideo({ actor: context, videoId: data.videoId });
    return { ok: true };
  });

export const listHomeModeration = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    if (context.role !== "superadmin")
      throw new Error("Only platform operators can open this queue.");
    const { listHomeModerationQueue } = await import("./home.server");
    return listHomeModerationQueue();
  });

export const toggleHomeLike = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ videoId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { toggleHomeLike: run } = await import("./home.server");
    return run({ userId: context.userId, videoId: data.videoId });
  });

export const toggleHomeSave = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ videoId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { toggleHomeSave: run } = await import("./home.server");
    return run({ userId: context.userId, videoId: data.videoId });
  });

export const recordHomeView = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ videoId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { recordHomeView: run } = await import("./home.server");
    return run({ userId: context.userId, videoId: data.videoId });
  });

export const reportHomeVideo = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        videoId: z.string().min(1),
        reason: z.enum(HOME_REPORT_REASONS),
        details: optionalText,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { reportHomeVideo: run } = await import("./home.server");
    await run({
      actor: context,
      videoId: data.videoId,
      reason: data.reason,
      details: data.details,
    });
    return { ok: true };
  });

export const resolveHomeReport = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ reportId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { resolveHomeReport: run } = await import("./home.server");
    await run({ actor: context, reportId: data.reportId });
    return { ok: true };
  });

export const setHomeInterests = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ subjects: z.array(z.enum(HOME_SUBJECTS)).max(8) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { setHomeInterests: run } = await import("./home.server");
    await run({ userId: context.userId, subjects: data.subjects });
    return { ok: true };
  });

export const loadHomeInterests = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { loadHomeInterests: load } = await import("./home.server");
    return load(context.userId);
  });
