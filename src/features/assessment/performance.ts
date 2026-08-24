import { adminGetById, adminSet, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";

export type TopicBucket = {
  attempts: number;
  points: number;
  max: number;
  percent: number;
};

export type PerformanceSummary = {
  student_id: string;
  school_id: string;
  by_subject: Record<string, TopicBucket>;
  by_topic: Record<string, TopicBucket>;
  graded_count: number;
  updated_at: string;
};

const MIN_EVIDENCE = 2;

function bump(map: Record<string, TopicBucket>, key: string, points: number, max: number) {
  const prev = map[key] ?? { attempts: 0, points: 0, max: 0, percent: 0 };
  const next = {
    attempts: prev.attempts + 1,
    points: prev.points + points,
    max: prev.max + max,
    percent: 0,
  };
  next.percent = next.max ? Math.round((next.points / next.max) * 100) : 0;
  map[key] = next;
}

export async function applyAttemptToSummary(input: {
  studentId: string;
  schoolId: string;
  subjectId: string | null;
  score: number;
  total: number;
  topicScores: Array<{ topic_id: string; points: number; max: number }>;
}) {
  const id = input.studentId;
  const existing = await adminGetById<PerformanceSummary>(COLLECTIONS.performanceSummaries, id);
  const by_subject = { ...(existing?.by_subject ?? {}) };
  const by_topic = { ...(existing?.by_topic ?? {}) };
  if (input.subjectId) bump(by_subject, input.subjectId, input.score, input.total);
  for (const row of input.topicScores) bump(by_topic, row.topic_id, row.points, row.max);
  const now = new Date().toISOString();
  await adminSet(COLLECTIONS.performanceSummaries, id, {
    student_id: input.studentId,
    school_id: input.schoolId,
    by_subject,
    by_topic,
    graded_count: (existing?.graded_count ?? 0) + 1,
    updated_at: now,
  });
}

export function weakAreas(summary: PerformanceSummary | null) {
  if (!summary) return [];
  const out: Array<{ key: string; scope: "subject" | "topic"; percent: number; attempts: number }> =
    [];
  for (const [key, bucket] of Object.entries(summary.by_subject ?? {})) {
    if (bucket.attempts >= MIN_EVIDENCE && bucket.percent < 60) {
      out.push({ key, scope: "subject", percent: bucket.percent, attempts: bucket.attempts });
    }
  }
  for (const [key, bucket] of Object.entries(summary.by_topic ?? {})) {
    if (bucket.attempts >= MIN_EVIDENCE && bucket.percent < 60) {
      out.push({ key, scope: "topic", percent: bucket.percent, attempts: bucket.attempts });
    }
  }
  return out.sort((a, b) => a.percent - b.percent).slice(0, 6);
}

export async function loadSummary(studentId: string) {
  return adminGetById<PerformanceSummary>(COLLECTIONS.performanceSummaries, studentId);
}

export async function subjectName(id: string) {
  const row = await adminGetById<{ name?: string }>(COLLECTIONS.subjects, id);
  return row?.name ?? "Subject";
}

export async function topicName(id: string) {
  const row = await adminGetById<{ name?: string }>(COLLECTIONS.curriculumTopics, id);
  return row?.name ?? "Topic";
}

export { adminWhere };
