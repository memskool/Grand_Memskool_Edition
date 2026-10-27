/** Pure Home feed rules — no I/O. Server and tests share this. */

export const HOME_SUBJECTS = [
  "mathematics",
  "chemistry",
  "physics",
  "biology",
  "geography",
  "english",
  "history",
  "economics",
  "computer_science",
  "languages",
  "exam_prep",
  "study_skills",
  "science_project",
  "other",
] as const;

export const HOME_LEVELS = [
  "nursery",
  "primary",
  "lower_secondary",
  "upper_secondary",
  "alevel",
  "university",
  "professional",
] as const;

export const HOME_VIDEO_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "removed",
] as const;

export const HOME_REPORT_REASONS = [
  "not_educational",
  "misleading",
  "unsafe_minors",
  "impersonation",
  "copyright",
  "other",
] as const;

export type HomeSubject = (typeof HOME_SUBJECTS)[number];
export type HomeLevel = (typeof HOME_LEVELS)[number];
export type HomeVideoStatus = (typeof HOME_VIDEO_STATUSES)[number];
export type HomeReportReason = (typeof HOME_REPORT_REASONS)[number];

export const MAX_HOME_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_HOME_CAPTION_BYTES = 2 * 1024 * 1024;
export const MAX_HOME_THUMB_BYTES = 5 * 1024 * 1024;
export const MIN_HOME_DURATION_SECONDS = 5;
export const MAX_HOME_DURATION_SECONDS = 180;
export const HOME_PAGE_SIZE = 8;
export const MAX_HOME_UPLOADS_PER_DAY = 8;
export const HOME_VIEW_WINDOW_MS = 12 * 60 * 60 * 1000;
export const HOME_REPORT_COOLDOWN_MS = 60 * 1000;
export const HOME_ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export function homeLikeId(videoId: string, userId: string): string {
  return `${videoId}_${userId}`;
}

export function homeSaveId(videoId: string, userId: string): string {
  return `${videoId}_${userId}`;
}

export function homeViewId(videoId: string, userId: string): string {
  return `${videoId}_${userId}`;
}

export function isPublishedHomeVideo(status: HomeVideoStatus | null | undefined): boolean {
  return status === "published";
}

export function canUploadHomeVideo(input: {
  role: string | null | undefined;
  teacherApproved?: boolean;
  goldApproved?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const role = input.role ?? "";
  if (role === "superadmin" || role === "admin" || role === "institution") return { ok: true };
  if (role === "teacher" && input.teacherApproved !== false) return { ok: true };
  if (input.goldApproved) return { ok: true };
  return {
    ok: false,
    reason: "Only approved teachers, school staff, or verified Gold tutors can publish on Home.",
  };
}

export function canPublishOnSchoolChannel(input: {
  role: string | null | undefined;
  claimSchoolId: string | null | undefined;
  targetSchoolId: string | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.targetSchoolId) return { ok: true };
  if (input.role === "superadmin") return { ok: true };
  if (input.role !== "admin" && input.role !== "institution") {
    return { ok: false, reason: "Only school administrators can publish as a school channel." };
  }
  if (!input.claimSchoolId || input.claimSchoolId !== input.targetSchoolId) {
    return { ok: false, reason: "You can only publish on your own school's channel." };
  }
  return { ok: true };
}

export function canSubmitHomeVideo(input: {
  status: HomeVideoStatus | null | undefined;
  ownerId: string;
  actorId: string;
  title: string;
  description: string;
  rightsConfirmed: boolean;
  noIdentifiableStudents: boolean;
  hasVideoFile: boolean;
  bytes: number;
  mimeType: string;
  durationSeconds: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.ownerId !== input.actorId)
    return { ok: false, reason: "Only the uploader can submit this video." };
  if (input.status !== "draft" && input.status !== "rejected") {
    return { ok: false, reason: "This video is already in review or published." };
  }
  if (input.title.trim().length < 3)
    return { ok: false, reason: "Add a title of at least 3 characters." };
  if (input.description.trim().length < 12) {
    return { ok: false, reason: "Add a short educational description." };
  }
  if (!input.rightsConfirmed)
    return { ok: false, reason: "Confirm you have the right to publish this video." };
  if (!input.noIdentifiableStudents) {
    return { ok: false, reason: "Confirm this clip does not expose identifiable student footage." };
  }
  if (!input.hasVideoFile) return { ok: false, reason: "Upload a video file before submitting." };
  if (input.bytes <= 0 || input.bytes > MAX_HOME_VIDEO_BYTES) {
    return { ok: false, reason: "Video must be present and at most 80 MB." };
  }
  if (
    !HOME_ALLOWED_VIDEO_TYPES.includes(input.mimeType as (typeof HOME_ALLOWED_VIDEO_TYPES)[number])
  ) {
    return { ok: false, reason: "Use an MP4, WebM or QuickTime video." };
  }
  if (
    input.durationSeconds < MIN_HOME_DURATION_SECONDS ||
    input.durationSeconds > MAX_HOME_DURATION_SECONDS
  ) {
    return { ok: false, reason: "Home clips must be between 5 seconds and 3 minutes." };
  }
  return { ok: true };
}

export function canModerateHomeVideo(input: { role: string | null | undefined }): boolean {
  return input.role === "superadmin";
}

export function canManageOwnHomeVideo(input: {
  actorId: string;
  creatorId: string;
  role: string | null | undefined;
  claimSchoolId: string | null | undefined;
  videoSchoolId: string | null | undefined;
}): boolean {
  if (input.actorId === input.creatorId) return true;
  if (input.role === "superadmin") return true;
  if (
    (input.role === "admin" || input.role === "institution") &&
    input.claimSchoolId &&
    input.videoSchoolId &&
    input.claimSchoolId === input.videoSchoolId
  ) {
    return true;
  }
  return false;
}

export function canCountHomeView(input: {
  userId: string | null | undefined;
  lastCountedAt: string | null | undefined;
  nowMs: number;
  windowMs?: number;
}): boolean {
  if (!input.userId) return false;
  if (!input.lastCountedAt) return true;
  const last = Date.parse(input.lastCountedAt);
  if (Number.isNaN(last)) return true;
  return input.nowMs - last >= (input.windowMs ?? HOME_VIEW_WINDOW_MS);
}

export function canReportHomeVideo(input: {
  lastReportAt: string | null | undefined;
  nowMs: number;
  cooldownMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.lastReportAt) return { ok: true };
  const last = Date.parse(input.lastReportAt);
  if (Number.isNaN(last)) return { ok: true };
  if (input.nowMs - last < (input.cooldownMs ?? HOME_REPORT_COOLDOWN_MS)) {
    return { ok: false, reason: "Please wait a minute before sending another report." };
  }
  return { ok: true };
}

export function canUploadAgainToday(input: { uploadsToday: number; max?: number }): boolean {
  return input.uploadsToday < (input.max ?? MAX_HOME_UPLOADS_PER_DAY);
}

export type RankableHomeVideo = {
  id: string;
  title: string;
  description: string;
  subject: string;
  topic: string | null;
  level: string;
  creator_name: string;
  school_name: string | null;
  published_at: string | null;
  like_count: number;
  view_count: number;
};

export function rankHomeVideos<T extends RankableHomeVideo>(
  videos: T[],
  input: {
    query?: string;
    subject?: string | null;
    level?: string | null;
    interests?: string[];
    seenIds?: string[];
    nowMs?: number;
  },
): T[] {
  const q = (input.query ?? "").trim().toLowerCase();
  const seen = new Set(input.seenIds ?? []);
  const interests = new Set((input.interests ?? []).map((item) => item.toLowerCase()));
  const now = input.nowMs ?? Date.now();

  return videos
    .filter((video) => {
      if (seen.has(video.id)) return false;
      if (input.subject && input.subject !== "all" && video.subject !== input.subject) return false;
      if (input.level && input.level !== "all" && video.level !== input.level) return false;
      if (!q) return true;
      return [video.title, video.description, video.topic, video.creator_name, video.school_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .map((video) => {
      const published = video.published_at ? Date.parse(video.published_at) : 0;
      const ageHours = Math.max(0, (now - published) / 3_600_000);
      const recency = Math.max(0, 72 - ageHours);
      const interestBoost = interests.has(video.subject) ? 12 : 0;
      const score = recency + video.like_count * 2 + video.view_count + interestBoost;
      return { video, score, published };
    })
    .sort((a, b) => b.score - a.score || b.published - a.published)
    .map((row) => row.video);
}

export function homeSubjectLabel(value: string): string {
  return value.replaceAll("_", " ");
}
