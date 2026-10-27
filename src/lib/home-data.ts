import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";
import { AppError } from "@/lib/errors/app-error";
import {
  createHomeDraft,
  listHomeModeration,
  listMyHomeVideos,
  loadHomeCreatorChannel,
  loadHomeFeed,
  loadHomeInterests,
  loadHomeSchoolChannel,
  loadHomeVideoPage,
  moderateHomeVideo,
  recordHomeView,
  reportHomeVideo,
  resolveHomeReport,
  setHomeInterests,
  submitHomeDraft,
  toggleHomeLike,
  toggleHomeSave,
  unpublishHomeVideo,
} from "@/features/home/home.functions";
import {
  HOME_LEVELS,
  HOME_SUBJECTS,
  MAX_HOME_CAPTION_BYTES,
  MAX_HOME_THUMB_BYTES,
  MAX_HOME_VIDEO_BYTES,
  homeSubjectLabel,
} from "@/features/home/policy";
import type { HomeVideo, HomeVideoCard } from "@/features/home/types";

export { HOME_LEVELS, HOME_SUBJECTS, homeSubjectLabel };

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "result", "payload", "value"]) {
      if (key in obj && obj[key] !== undefined) return unwrap<T>(obj[key]);
    }
  }
  return raw as T;
}

export type HomeFeedPage = {
  items: HomeVideoCard[];
  nextCursor: string | null;
  ranking: string;
};

export function useHomeFeed(input: { query: string; subject: string; level: string }) {
  return useQuery({
    queryKey: ["home-feed", input],
    queryFn: async () =>
      unwrap<HomeFeedPage>(
        await loadHomeFeed({
          data: {
            query: input.query || undefined,
            subject: input.subject as (typeof HOME_SUBJECTS)[number] | "all",
            level: input.level as (typeof HOME_LEVELS)[number] | "all",
            cursor: null,
          },
        }),
      ),
  });
}

export function useHomeVideoPage(videoId: string | undefined) {
  return useQuery({
    queryKey: ["home-video", videoId],
    enabled: Boolean(videoId),
    queryFn: async () =>
      unwrap<{ video: HomeVideoCard; related: HomeVideoCard[] } | null>(
        await loadHomeVideoPage({ data: { videoId: videoId! } }),
      ),
  });
}

export function useHomeSchoolChannel(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["home-school", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => unwrap(await loadHomeSchoolChannel({ data: { schoolId: schoolId! } })),
  });
}

export function useHomeCreatorChannel(creatorId: string | undefined) {
  return useQuery({
    queryKey: ["home-creator", creatorId],
    enabled: Boolean(creatorId),
    queryFn: async () => unwrap(await loadHomeCreatorChannel({ data: { creatorId: creatorId! } })),
  });
}

export function useMyHomeVideos() {
  return useQuery({
    queryKey: ["home-mine"],
    queryFn: async () => unwrap<HomeVideo[]>(await listMyHomeVideos()),
  });
}

export function useHomeModeration() {
  return useQuery({
    queryKey: ["home-moderation"],
    queryFn: async () => unwrap(await listHomeModeration()),
  });
}

export function useHomeInterests() {
  return useQuery({
    queryKey: ["home-interests"],
    queryFn: async () => unwrap<string[]>(await loadHomeInterests()),
  });
}

export function useHomeLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: string) => unwrap(await toggleHomeLike({ data: { videoId } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["home-feed"] }),
  });
}

export function useHomeSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: string) => unwrap(await toggleHomeSave({ data: { videoId } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-feed"] });
      void qc.invalidateQueries({ queryKey: ["locker-items"] });
    },
  });
}

export function useHomeView() {
  return useMutation({
    mutationFn: async (videoId: string) => unwrap(await recordHomeView({ data: { videoId } })),
  });
}

export function useHomeReport() {
  return useMutation({
    mutationFn: async (input: {
      videoId: string;
      reason:
        | "not_educational"
        | "misleading"
        | "unsafe_minors"
        | "impersonation"
        | "copyright"
        | "other";
      details: string | null;
    }) => unwrap(await reportHomeVideo({ data: input })),
  });
}

export type HomeDraftInput = {
  title: string;
  description: string;
  subject: (typeof HOME_SUBJECTS)[number];
  topic: string | null;
  level: (typeof HOME_LEVELS)[number];
  curriculum: string | null;
  language: string;
  durationSeconds: number;
  publishAsSchool: boolean;
};

export function useSubmitHomeDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: HomeDraftInput & {
        videoId: string;
        rightsConfirmed: boolean;
        noIdentifiableStudents: boolean;
        hasCaption: boolean;
        hasThumbnail: boolean;
      },
    ) => unwrap(await submitHomeDraft({ data: input })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["home-mine"] }),
  });
}

export function useCreateHomeDraft() {
  return useMutation({
    mutationFn: async (input: HomeDraftInput) =>
      unwrap<{ videoId: string; storagePath: string; thumbnailPath: string; captionPath: string }>(
        await createHomeDraft({ data: input }),
      ),
  });
}

export function useUnpublishHome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: string) => unwrap(await unpublishHomeVideo({ data: { videoId } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["home-mine"] }),
  });
}

export function useModerateHome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      videoId: string;
      decision: "approve" | "reject" | "remove";
      note?: string | null;
    }) => unwrap(await moderateHomeVideo({ data: input })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["home-moderation"] }),
  });
}

export function useResolveHomeReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => unwrap(await resolveHomeReport({ data: { reportId } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["home-moderation"] }),
  });
}

export function useSetHomeInterests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subjects: string[]) =>
      unwrap(await setHomeInterests({ data: { subjects: subjects as never } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-interests"] });
      void qc.invalidateQueries({ queryKey: ["home-feed"] });
    },
  });
}

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const duration = Number.isFinite(el.duration) ? Math.round(el.duration) : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that video file."));
    };
    el.src = url;
  });
}

export async function uploadHomeFile(
  objectPath: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AppError("auth", "Sign in to upload.");
  if (file.size > MAX_HOME_VIDEO_BYTES) {
    throw new AppError("validation", "That file is larger than the 80 MB Home limit.");
  }
  const storageRef = ref(getFirebaseStorage(), objectPath);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || undefined });
    task.on(
      "state_changed",
      (snap) => {
        if (snap.totalBytes > 0)
          onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      () => resolve(),
    );
  });
}

export function assertHomeThumb(file: File) {
  if (!file.type.startsWith("image/"))
    throw new AppError("validation", "Thumbnail must be an image.");
  if (file.size > MAX_HOME_THUMB_BYTES)
    throw new AppError("validation", "Thumbnail must be 5 MB or smaller.");
}

export function assertHomeCaption(file: File) {
  if (file.size > MAX_HOME_CAPTION_BYTES)
    throw new AppError("validation", "Caption file is too large.");
}

export async function probeHomeObject(path: string): Promise<string | null> {
  try {
    return await getDownloadURL(ref(getFirebaseStorage(), path));
  } catch {
    return null;
  }
}
