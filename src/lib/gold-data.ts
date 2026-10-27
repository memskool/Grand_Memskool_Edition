import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addGoldClassResource,
  applyToTeachGold,
  copyGoldResourceLocker,
  endGoldClassLesson,
  enrolGoldClass,
  listGoldTutorApplications,
  listMyGoldClasses,
  loadGoldClassEnrolments,
  loadGoldClassPage,
  loadGoldDirectory,
  loadGoldTutorProfile,
  loadMyGoldEnrolments,
  loadMyGoldTutor,
  reportGoldClassReview,
  reviewGoldTutorApplication,
  saveGoldClass,
  scheduleGoldClassLesson,
  setGoldPlatformCommission,
  startGoldClassLesson,
  submitGoldClassReview,
} from "@/features/gold/gold.functions";
import type { GoldClass, GoldEnrolment, GoldTutor } from "@/features/gold/types";
import { GOLD_LEVELS, GOLD_SUBJECTS, ratingAverage } from "@/features/gold/policy";

export { GOLD_LEVELS, GOLD_SUBJECTS, ratingAverage };

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "result", "payload", "value"]) {
      if (key in obj && obj[key] !== undefined) return unwrap<T>(obj[key]);
    }
  }
  return raw as T;
}

export function goldSubjectLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function useGoldDirectory() {
  return useQuery({
    queryKey: ["gold-directory"],
    queryFn: async () =>
      unwrap<{ tutors: GoldTutor[]; classes: GoldClass[] }>(await loadGoldDirectory()),
  });
}

export function useMyGoldTutor() {
  return useQuery({
    queryKey: ["gold-tutor-me"],
    queryFn: async () => unwrap<GoldTutor | null>(await loadMyGoldTutor()),
  });
}

export function useGoldTutorProfile(tutorId: string | undefined) {
  return useQuery({
    queryKey: ["gold-tutor", tutorId],
    enabled: Boolean(tutorId),
    queryFn: async () =>
      unwrap<{
        tutor: GoldTutor;
        classes: GoldClass[];
        reviews: Array<{
          id: string;
          rating: number;
          body: string | null;
          created_at: string;
          reported: boolean;
        }>;
      } | null>(await loadGoldTutorProfile({ data: { tutorId: tutorId! } })),
  });
}

export function useGoldClassPage(classId: string | undefined) {
  return useQuery({
    queryKey: ["gold-class", classId],
    enabled: Boolean(classId),
    queryFn: async () => unwrap(await loadGoldClassPage({ data: { classId: classId! } })),
  });
}

export function useMyGoldEnrolments() {
  return useQuery({
    queryKey: ["gold-enrolments-me"],
    queryFn: async () => unwrap<GoldEnrolment[]>(await loadMyGoldEnrolments()),
  });
}

export function useMyGoldClasses() {
  return useQuery({
    queryKey: ["gold-classes-me"],
    queryFn: async () => unwrap<GoldClass[]>(await listMyGoldClasses()),
  });
}

export function useGoldApplications() {
  return useQuery({
    queryKey: ["gold-applications"],
    queryFn: async () => unwrap<GoldTutor[]>(await listGoldTutorApplications()),
  });
}

export function useApplyGold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      bio: string;
      subjects: Array<(typeof GOLD_SUBJECTS)[number]>;
      levels: Array<(typeof GOLD_LEVELS)[number]>;
      languages: string[];
      curriculum: string | null;
      qualifications: string;
      experienceYears: number;
      documentUrls: string[];
      photoUrl: string | null;
      delivery: Array<"live" | "recorded" | "mixed">;
    }) => applyToTeachGold({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gold-tutor-me"] });
    },
  });
}

export function useSaveGoldClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      classId?: string;
      title: string;
      description: string;
      subject: (typeof GOLD_SUBJECTS)[number];
      topic: string | null;
      level: (typeof GOLD_LEVELS)[number];
      curriculum: string | null;
      objectives: string;
      language: string;
      delivery: "live" | "recorded" | "mixed";
      priceCents: number;
      currency: string;
      capacity: number;
      timezone: string;
      startsAt: string;
      endsAt: string;
      cancellationTerms: string | null;
      publish: boolean;
    }) => saveGoldClass({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gold-classes-me"] });
      void qc.invalidateQueries({ queryKey: ["gold-directory"] });
    },
  });
}

export function useEnrolGold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) =>
      unwrap<{ paymentLink: string | null; reference: string | null }>(
        await enrolGoldClass({ data: { classId } }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gold-class"] });
      void qc.invalidateQueries({ queryKey: ["gold-enrolments-me"] });
    },
  });
}

export function useReviewGoldApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tutorId: string;
      decision: "approved" | "rejected" | "suspended";
      note: string | null;
    }) => reviewGoldTutorApplication({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gold-applications"] });
      void qc.invalidateQueries({ queryKey: ["gold-directory"] });
    },
  });
}

export function useScheduleGoldLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { classId: string; title: string; startsAt: string; endsAt: string }) =>
      scheduleGoldClassLesson({ data: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gold-class"] }),
  });
}

export function useStartGoldLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) =>
      unwrap<{ sessionId: string }>(await startGoldClassLesson({ data: { lessonId } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gold-class"] }),
  });
}

export function useEndGoldLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => endGoldClassLesson({ data: { lessonId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gold-class"] }),
  });
}

export function useAddGoldResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { classId: string; title: string; url: string | null }) =>
      addGoldClassResource({ data: { ...input, storagePath: null } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gold-class"] }),
  });
}

export function useCopyGoldToLocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: string) => copyGoldResourceLocker({ data: { resourceId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-items"] }),
  });
}

export function useSubmitGoldReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { classId: string; rating: number; body: string | null }) =>
      submitGoldClassReview({ data: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gold-class"] }),
  });
}

export function useReportGoldReview() {
  return useMutation({
    mutationFn: (reviewId: string) => reportGoldClassReview({ data: { reviewId } }),
  });
}

export function useGoldClassEnrolments(classId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["gold-class-enrolments", classId],
    enabled: Boolean(classId) && enabled,
    queryFn: async () => unwrap(await loadGoldClassEnrolments({ data: { classId: classId! } })),
  });
}

export function useSetGoldCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commissionBps: number) => setGoldPlatformCommission({ data: { commissionBps } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gold-directory"] }),
  });
}

export function priceLabel(cents: number, currency: string) {
  if (cents <= 0) return "Free";
  return `${currency} ${cents.toLocaleString()}`;
}
