import "@tanstack/react-start/server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebase/admin.server";
import { adminCreate, adminGetById, adminSet, adminUpdate } from "@/lib/firebase/admin-repo";
import { toClientJson } from "@/lib/firebase/plain-data";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AppRole } from "@/types/roles";
import type { GoldTutor } from "@/features/gold/types";
import {
  HOME_PAGE_SIZE,
  canCountHomeView,
  canManageOwnHomeVideo,
  canModerateHomeVideo,
  canPublishOnSchoolChannel,
  canReportHomeVideo,
  canSubmitHomeVideo,
  canUploadAgainToday,
  canUploadHomeVideo,
  homeLikeId,
  homeSaveId,
  homeViewId,
  isPublishedHomeVideo,
  rankHomeVideos,
  type HomeLevel,
  type HomeReportReason,
  type HomeSubject,
} from "./policy";
import type { HomeReport, HomeSchoolChannel, HomeVideo, HomeVideoCard } from "./types";
import {
  forgetHomeReport,
  forgetPendingHomeVideo,
  forgetPublishedHomeVideo,
  loadCreatorHomeIds,
  loadHomeVideosByIds,
  loadOpenHomeReportIds,
  loadPendingHomeIds,
  loadPublishedHomeIds,
  loadSchoolHomeIds,
  rememberCreatorHomeVideo,
  rememberHomeReport,
  rememberPendingHomeVideo,
  rememberPublishedHomeVideo,
  rememberSchoolHomeVideo,
} from "./catalog.server";

type Actor = {
  userId: string;
  role: AppRole | null;
  schoolId: string | null;
  approved: boolean;
  email: string | null;
};

async function isGoldApproved(userId: string): Promise<boolean> {
  const tutor = await adminGetById<GoldTutor>(COLLECTIONS.goldTutors, userId);
  return tutor?.status === "approved";
}

async function assertCanUpload(actor: Actor): Promise<void> {
  const goldApproved = await isGoldApproved(actor.userId);
  const gate = canUploadHomeVideo({
    role: actor.role,
    teacherApproved: actor.approved,
    goldApproved,
  });
  if (!gate.ok) throw new Error(gate.reason);
}

async function signedReadUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const file = adminStorage().bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return url;
  } catch {
    return null;
  }
}

function toCard(
  video: HomeVideo,
  urls: { playback: string | null; thumb: string | null; caption: string | null },
  flags?: { liked?: boolean; saved?: boolean },
): HomeVideoCard {
  return {
    id: video.id,
    creator_id: video.creator_id,
    creator_name: video.creator_name,
    creator_kind: video.creator_kind,
    school_id: video.school_id,
    school_name: video.school_name,
    title: video.title,
    description: video.description,
    subject: video.subject,
    topic: video.topic,
    level: video.level,
    curriculum: video.curriculum,
    language: video.language,
    duration_seconds: video.duration_seconds,
    like_count: video.like_count,
    save_count: video.save_count,
    view_count: video.view_count,
    published_at: video.published_at,
    playback_url: urls.playback,
    thumbnail_url: urls.thumb,
    caption_url: urls.caption,
    liked: flags?.liked ?? false,
    saved: flags?.saved ?? false,
  };
}

async function hydrateCards(videos: HomeVideo[], userId: string | null): Promise<HomeVideoCard[]> {
  return Promise.all(
    videos.map(async (video) => {
      try {
        const [playback, thumb, caption, liked, saved] = await Promise.all([
          isPublishedHomeVideo(video.status) || video.creator_id === userId
            ? signedReadUrl(video.storage_path)
            : Promise.resolve(null),
          signedReadUrl(video.thumbnail_path),
          video.caption_path && (isPublishedHomeVideo(video.status) || video.creator_id === userId)
            ? signedReadUrl(video.caption_path)
            : Promise.resolve(null),
          userId
            ? adminGetById(COLLECTIONS.homeLikes, homeLikeId(video.id, userId)).then(Boolean)
            : Promise.resolve(false),
          userId
            ? adminGetById(COLLECTIONS.homeSaves, homeSaveId(video.id, userId)).then(Boolean)
            : Promise.resolve(false),
        ]);
        return toCard(video, { playback, thumb, caption }, { liked, saved });
      } catch {
        return toCard(video, { playback: null, thumb: null, caption: null });
      }
    }),
  );
}

function publicSchool(
  school: {
    name?: string;
    city?: string | null;
    country?: string | null;
    description?: string | null;
    logo_url?: string | null;
    website?: string | null;
    admissions_open?: boolean;
  } | null,
): HomeSchoolChannel | null {
  if (!school) return null;
  return {
    id: "",
    name: school.name ?? "School",
    city: school.city ?? null,
    country: school.country ?? null,
    description: school.description ?? null,
    logo_url: school.logo_url ?? null,
    website: school.website ?? null,
    admissions_open: school.admissions_open === true,
  };
}

const HOME_RANKING =
  "Rule-based: recency, likes, unique views, and your selected subjects. Not an AI ranker.";

export async function loadHomeFeed(input: {
  userId: string | null;
  query?: string;
  subject?: string | null;
  level?: string | null;
  cursor?: string | null;
}): Promise<{ items: HomeVideoCard[]; nextCursor: string | null; ranking: string }> {
  try {
    let ids: string[] = [];
    try {
      ids = await loadPublishedHomeIds();
    } catch (error) {
      console.error("home catalog", error);
    }
    const videos = (await loadHomeVideosByIds(ids)).filter((row) =>
      isPublishedHomeVideo(row.status),
    );
    let interests: string[] = [];
    if (input.userId) {
      try {
        const pref = await adminGetById<{ subjects?: string[] }>(
          COLLECTIONS.homeInterests,
          input.userId,
        );
        interests = Array.isArray(pref?.subjects) ? pref.subjects : [];
      } catch (error) {
        console.error("home interests", error);
      }
    }
    const ranked = rankHomeVideos(videos, {
      ...(input.query ? { query: input.query } : {}),
      subject: input.subject ?? null,
      level: input.level ?? null,
      interests,
    });
    const start = input.cursor ? ranked.findIndex((row) => row.id === input.cursor) + 1 : 0;
    const slice = ranked.slice(Math.max(0, start), Math.max(0, start) + HOME_PAGE_SIZE);
    const items = await hydrateCards(slice, input.userId);
    const last = slice[slice.length - 1];
    const more = start + slice.length < ranked.length;
    return toClientJson({
      items,
      nextCursor: more && last ? last.id : null,
      ranking: HOME_RANKING,
    });
  } catch (error) {
    console.error("loadHomeFeed", error);
    return { items: [], nextCursor: null, ranking: HOME_RANKING };
  }
}

export async function loadHomeVideoPage(
  videoId: string,
  userId: string | null,
): Promise<{ video: HomeVideoCard; related: HomeVideoCard[] } | null> {
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, videoId);
  if (!video || !isPublishedHomeVideo(video.status)) return null;
  const ids = await loadPublishedHomeIds();
  const relatedSource = (await loadHomeVideosByIds(ids))
    .filter((row) => row.id !== videoId && isPublishedHomeVideo(row.status))
    .slice(0, 12);
  const relatedRanked = rankHomeVideos(relatedSource, { subject: video.subject }).slice(0, 6);
  const [card, related] = await Promise.all([
    hydrateCards([video], userId),
    hydrateCards(relatedRanked, userId),
  ]);
  const first = card[0];
  if (!first) return null;
  return { video: first, related };
}

export async function loadHomeSchoolChannel(
  schoolId: string,
  userId: string | null,
): Promise<{ school: HomeSchoolChannel; videos: HomeVideoCard[] } | null> {
  const school = await adminGetById<{
    name?: string;
    city?: string | null;
    country?: string | null;
    description?: string | null;
    logo_url?: string | null;
    website?: string | null;
    admissions_open?: boolean;
  }>(COLLECTIONS.schools, schoolId);
  if (!school) return null;
  const publicProfile = publicSchool(school);
  if (!publicProfile) return null;
  publicProfile.id = schoolId;
  const ids = await loadSchoolHomeIds(schoolId);
  const videos = (await loadHomeVideosByIds(ids)).filter((row) => isPublishedHomeVideo(row.status));
  return { school: publicProfile, videos: await hydrateCards(videos, userId) };
}

export async function loadHomeCreatorChannel(
  creatorId: string,
  userId: string | null,
): Promise<{ creatorName: string; videos: HomeVideoCard[] } | null> {
  const ids = await loadCreatorHomeIds(creatorId);
  const videos = (await loadHomeVideosByIds(ids)).filter((row) => isPublishedHomeVideo(row.status));
  if (videos.length === 0) {
    const user = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, creatorId);
    if (!user) return null;
    return { creatorName: user.full_name || "Creator", videos: [] };
  }
  return {
    creatorName: videos[0]?.creator_name ?? "Creator",
    videos: await hydrateCards(videos, userId),
  };
}

export async function listMyHomeVideos(userId: string): Promise<HomeVideo[]> {
  const ids = await loadCreatorHomeIds(userId);
  return loadHomeVideosByIds(ids);
}

export async function createHomeDraft(input: {
  actor: Actor;
  title: string;
  description: string;
  subject: HomeSubject;
  topic: string | null;
  level: HomeLevel;
  curriculum: string | null;
  language: string;
  durationSeconds: number;
  publishAsSchool: boolean;
}): Promise<{ videoId: string; storagePath: string; thumbnailPath: string; captionPath: string }> {
  await assertCanUpload(input.actor);
  const today = new Date().toISOString().slice(0, 10);
  const rate = await adminGetById<{ date?: string; uploads?: number }>(
    COLLECTIONS.homeRateLimits,
    input.actor.userId,
  );
  const uploadsToday = rate?.date === today ? (rate.uploads ?? 0) : 0;
  if (!canUploadAgainToday({ uploadsToday })) {
    throw new Error("You have reached today's Home upload limit.");
  }

  let schoolId: string | null = null;
  let schoolName: string | null = null;
  let creatorKind: HomeVideo["creator_kind"] =
    input.actor.role === "teacher" ? "teacher" : "creator";
  if (input.publishAsSchool) {
    const schoolGate = canPublishOnSchoolChannel({
      role: input.actor.role,
      claimSchoolId: input.actor.schoolId,
      targetSchoolId: input.actor.schoolId,
    });
    if (!schoolGate.ok) throw new Error(schoolGate.reason);
    if (!input.actor.schoolId) throw new Error("Your account is not attached to a school.");
    const school = await adminGetById<{ name?: string }>(COLLECTIONS.schools, input.actor.schoolId);
    if (!school) throw new Error("That school was not found.");
    schoolId = input.actor.schoolId;
    schoolName = school.name ?? "School";
    creatorKind = "school";
  }

  const profile = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, input.actor.userId);
  const now = new Date().toISOString();
  const videoId = adminDb().collection(COLLECTIONS.homeVideos).doc().id;
  const storagePath = `home/${input.actor.userId}/${videoId}/video`;
  const thumbnailPath = `home/${input.actor.userId}/${videoId}/thumb`;
  const captionPath = `home/${input.actor.userId}/${videoId}/captions.vtt`;

  const row: Omit<HomeVideo, "id"> = {
    creator_id: input.actor.userId,
    creator_name: profile?.full_name || input.actor.email?.split("@")[0] || "Creator",
    creator_kind: creatorKind,
    school_id: schoolId,
    school_name: schoolName,
    title: input.title,
    description: input.description,
    subject: input.subject,
    topic: input.topic,
    level: input.level,
    curriculum: input.curriculum,
    language: input.language,
    storage_path: storagePath,
    caption_path: null,
    thumbnail_path: null,
    duration_seconds: input.durationSeconds,
    file_size: 0,
    mime_type: "",
    status: "draft",
    rights_confirmed: false,
    no_identifiable_students: false,
    like_count: 0,
    save_count: 0,
    view_count: 0,
    report_count: 0,
    rejection_note: null,
    published_at: null,
    created_at: now,
    updated_at: now,
  };
  await adminSet(COLLECTIONS.homeVideos, videoId, row, false);
  await rememberCreatorHomeVideo(input.actor.userId, videoId);
  if (schoolId) await rememberSchoolHomeVideo(schoolId, videoId);
  await adminSet(
    COLLECTIONS.homeRateLimits,
    input.actor.userId,
    { date: today, uploads: uploadsToday + 1, updated_at: now },
    true,
  );
  return { videoId, storagePath, thumbnailPath, captionPath };
}

export async function submitHomeDraft(input: {
  actor: Actor;
  videoId: string;
  title: string;
  description: string;
  subject: HomeSubject;
  topic: string | null;
  level: HomeLevel;
  curriculum: string | null;
  language: string;
  durationSeconds: number;
  rightsConfirmed: boolean;
  noIdentifiableStudents: boolean;
  hasCaption: boolean;
  hasThumbnail: boolean;
}): Promise<HomeVideo> {
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, input.videoId);
  if (!video) throw new Error("That video was not found.");
  if (video.creator_id !== input.actor.userId)
    throw new Error("Only the uploader can submit this video.");

  const file = adminStorage().bucket().file(video.storage_path);
  const [exists] = await file.exists();
  let bytes = 0;
  let mime = "";
  if (exists) {
    const [meta] = await file.getMetadata();
    bytes = Number(meta.size ?? 0);
    mime = String(meta.contentType ?? "");
  }
  const gate = canSubmitHomeVideo({
    status: video.status,
    ownerId: video.creator_id,
    actorId: input.actor.userId,
    title: input.title,
    description: input.description,
    rightsConfirmed: input.rightsConfirmed,
    noIdentifiableStudents: input.noIdentifiableStudents,
    hasVideoFile: exists,
    bytes,
    mimeType: mime,
    durationSeconds: input.durationSeconds,
  });
  if (!gate.ok) throw new Error(gate.reason);

  const now = new Date().toISOString();
  const patch = {
    title: input.title,
    description: input.description,
    subject: input.subject,
    topic: input.topic,
    level: input.level,
    curriculum: input.curriculum,
    language: input.language,
    duration_seconds: input.durationSeconds,
    file_size: bytes,
    mime_type: mime,
    rights_confirmed: true,
    no_identifiable_students: true,
    caption_path: input.hasCaption ? `home/${input.actor.userId}/${video.id}/captions.vtt` : null,
    thumbnail_path: input.hasThumbnail ? `home/${input.actor.userId}/${video.id}/thumb` : null,
    status: "pending_review" as const,
    updated_at: now,
  };
  await adminUpdate(COLLECTIONS.homeVideos, video.id, patch);
  await rememberPendingHomeVideo(video.id);
  return { ...video, ...patch };
}

export async function moderateHomeVideo(input: {
  actor: Actor;
  videoId: string;
  decision: "approve" | "reject" | "remove";
  note?: string | null;
}): Promise<void> {
  if (!canModerateHomeVideo({ role: input.actor.role })) {
    throw new Error("Only platform operators can moderate Home videos.");
  }
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, input.videoId);
  if (!video) throw new Error("That video was not found.");
  const now = new Date().toISOString();
  if (input.decision === "approve") {
    await adminUpdate(COLLECTIONS.homeVideos, video.id, {
      status: "published",
      published_at: now,
      rejection_note: null,
      updated_at: now,
    });
    await forgetPendingHomeVideo(video.id);
    await rememberPublishedHomeVideo(video.id);
  } else if (input.decision === "reject") {
    await adminUpdate(COLLECTIONS.homeVideos, video.id, {
      status: "rejected",
      rejection_note: input.note ?? "This clip was not approved for Home.",
      updated_at: now,
    });
    await forgetPendingHomeVideo(video.id);
    await forgetPublishedHomeVideo(video.id);
  } else {
    await adminUpdate(COLLECTIONS.homeVideos, video.id, {
      status: "removed",
      updated_at: now,
    });
    await forgetPendingHomeVideo(video.id);
    await forgetPublishedHomeVideo(video.id);
  }
  await adminCreate(COLLECTIONS.auditLogs, {
    type: "home_moderation",
    actor_id: input.actor.userId,
    school_id: null,
    target_id: video.id,
    summary: `Home video ${input.decision}`,
    created_at: now,
  });
}

export async function unpublishOwnHomeVideo(input: {
  actor: Actor;
  videoId: string;
}): Promise<void> {
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, input.videoId);
  if (!video) throw new Error("That video was not found.");
  if (
    !canManageOwnHomeVideo({
      actorId: input.actor.userId,
      creatorId: video.creator_id,
      role: input.actor.role,
      claimSchoolId: input.actor.schoolId,
      videoSchoolId: video.school_id,
    })
  ) {
    throw new Error("You cannot change this video.");
  }
  const now = new Date().toISOString();
  await adminUpdate(COLLECTIONS.homeVideos, video.id, { status: "removed", updated_at: now });
  await forgetPublishedHomeVideo(video.id);
  await forgetPendingHomeVideo(video.id);
}

export async function listHomeModerationQueue(): Promise<{
  pending: HomeVideo[];
  reports: Array<HomeReport & { title: string }>;
}> {
  const [pendingIds, reportIds] = await Promise.all([
    loadPendingHomeIds(),
    loadOpenHomeReportIds(),
  ]);
  const pending = await loadHomeVideosByIds(pendingIds);
  const reportRefs = reportIds
    .slice(0, 80)
    .map((id) => adminDb().collection(COLLECTIONS.homeReports).doc(id));
  const reportSnaps = reportRefs.length ? await adminDb().getAll(...reportRefs) : [];
  const reports = await Promise.all(
    reportSnaps
      .filter((snap) => snap.exists)
      .map(async (snap) => {
        const row = { ...(snap.data() as HomeReport), id: snap.id };
        const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, row.video_id);
        return { ...row, title: video?.title ?? "" };
      }),
  );
  return { pending: pending.filter((row) => row.status === "pending_review"), reports };
}

export async function toggleHomeLike(input: {
  userId: string;
  videoId: string;
}): Promise<{ liked: boolean }> {
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, input.videoId);
  if (!video || !isPublishedHomeVideo(video.status))
    throw new Error("That video is not available.");
  const id = homeLikeId(input.videoId, input.userId);
  const existing = await adminGetById(COLLECTIONS.homeLikes, id);
  if (existing) {
    await adminDb().collection(COLLECTIONS.homeLikes).doc(id).delete();
    await adminUpdate(COLLECTIONS.homeVideos, input.videoId, {
      like_count: FieldValue.increment(-1),
    });
    return { liked: false };
  }
  await adminSet(
    COLLECTIONS.homeLikes,
    id,
    { video_id: input.videoId, user_id: input.userId, created_at: new Date().toISOString() },
    false,
  );
  await adminUpdate(COLLECTIONS.homeVideos, input.videoId, { like_count: FieldValue.increment(1) });
  return { liked: true };
}

export async function toggleHomeSave(input: {
  userId: string;
  videoId: string;
}): Promise<{ saved: boolean }> {
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, input.videoId);
  if (!video || !isPublishedHomeVideo(video.status))
    throw new Error("That video is not available.");
  const id = homeSaveId(input.videoId, input.userId);
  const existing = await adminGetById(COLLECTIONS.homeSaves, id);
  if (existing) {
    await adminDb().collection(COLLECTIONS.homeSaves).doc(id).delete();
    await adminUpdate(COLLECTIONS.homeVideos, input.videoId, {
      save_count: FieldValue.increment(-1),
    });
    return { saved: false };
  }
  const now = new Date().toISOString();
  await adminSet(
    COLLECTIONS.homeSaves,
    id,
    { video_id: input.videoId, user_id: input.userId, created_at: now },
    false,
  );
  await adminUpdate(COLLECTIONS.homeVideos, input.videoId, { save_count: FieldValue.increment(1) });
  await adminCreate(COLLECTIONS.lockerItems, {
    owner_id: input.userId,
    title: `Home: ${video.title}`,
    kind: "link",
    url: `/home/${video.id}`,
    from_home: true,
    home_video_id: video.id,
    created_at: now,
  });
  return { saved: true };
}

export async function recordHomeView(input: {
  userId: string;
  videoId: string;
}): Promise<{ counted: boolean }> {
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, input.videoId);
  if (!video || !isPublishedHomeVideo(video.status)) return { counted: false };
  const id = homeViewId(input.videoId, input.userId);
  const existing = await adminGetById<{ counted_at?: string }>(COLLECTIONS.homeViews, id);
  const now = new Date();
  if (
    !canCountHomeView({
      userId: input.userId,
      lastCountedAt: existing?.counted_at ?? null,
      nowMs: now.getTime(),
    })
  ) {
    return { counted: false };
  }
  await adminSet(
    COLLECTIONS.homeViews,
    id,
    { video_id: input.videoId, user_id: input.userId, counted_at: now.toISOString() },
    true,
  );
  await adminUpdate(COLLECTIONS.homeVideos, input.videoId, { view_count: FieldValue.increment(1) });
  return { counted: true };
}

export async function reportHomeVideo(input: {
  actor: Actor;
  videoId: string;
  reason: HomeReportReason;
  details: string | null;
}): Promise<void> {
  const video = await adminGetById<HomeVideo>(COLLECTIONS.homeVideos, input.videoId);
  if (!video || !isPublishedHomeVideo(video.status))
    throw new Error("That video is not available.");
  const rate = await adminGetById<{ last_report_at?: string }>(
    COLLECTIONS.homeRateLimits,
    input.actor.userId,
  );
  const gate = canReportHomeVideo({
    lastReportAt: rate?.last_report_at ?? null,
    nowMs: Date.now(),
  });
  if (!gate.ok) throw new Error(gate.reason);
  const now = new Date().toISOString();
  const reportId = await adminCreate(COLLECTIONS.homeReports, {
    video_id: input.videoId,
    reporter_id: input.actor.userId,
    reason: input.reason,
    details: input.details,
    status: "open",
    created_at: now,
  });
  await rememberHomeReport(reportId);
  await adminUpdate(COLLECTIONS.homeVideos, input.videoId, {
    report_count: FieldValue.increment(1),
  });
  await adminSet(
    COLLECTIONS.homeRateLimits,
    input.actor.userId,
    { last_report_at: now, updated_at: now },
    true,
  );
}

export async function resolveHomeReport(input: { actor: Actor; reportId: string }): Promise<void> {
  if (!canModerateHomeVideo({ role: input.actor.role })) {
    throw new Error("Only platform operators can close Home reports.");
  }
  await adminUpdate(COLLECTIONS.homeReports, input.reportId, { status: "resolved" });
  await forgetHomeReport(input.reportId);
}

export async function setHomeInterests(input: {
  userId: string;
  subjects: string[];
}): Promise<void> {
  await adminSet(
    COLLECTIONS.homeInterests,
    input.userId,
    { subjects: input.subjects.slice(0, 8), updated_at: new Date().toISOString() },
    true,
  );
}

export async function loadHomeInterests(userId: string): Promise<string[]> {
  const row = await adminGetById<{ subjects?: string[] }>(COLLECTIONS.homeInterests, userId);
  return Array.isArray(row?.subjects) ? row.subjects : [];
}
