import { z } from "zod";

export const ASSESSMENT_TYPES = ["practice", "quiz", "test", "exam"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const QUESTION_KINDS = [
  "multiple_choice",
  "multiple_select",
  "true_false",
  "short_answer",
  "long_answer",
] as const;
export type EngineQuestionKind = (typeof QUESTION_KINDS)[number];

export const ATTEMPT_STATUSES = ["in_progress", "submitted", "awaiting_manual", "graded"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const DraftQuestionSchema = z.object({
  kind: z.enum(QUESTION_KINDS),
  prompt: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().max(500)).max(8),
  correct_answer: z.string().max(8000),
  accepted: z.array(z.string().trim().max(500)).max(12).optional(),
  points: z.number().int().min(1).max(100),
  topic_id: z.string().min(1).nullable().optional(),
  explanation: z.string().trim().max(2000).nullable().optional(),
  save_to_bank: z.boolean().optional(),
});

export const SaveAssessmentSchema = z.object({
  assessmentId: z.string().min(1).nullable(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000),
  class_id: z.string().min(1),
  subject_id: z.string().min(1).nullable(),
  type: z.enum(ASSESSMENT_TYPES),
  time_limit_minutes: z.number().int().min(0).max(360),
  passing_score: z.number().int().min(0).max(100),
  max_attempts: z.number().int().min(0).max(20),
  available_from: z.string().max(40).nullable(),
  available_until: z.string().max(40).nullable(),
  results_released: z.boolean(),
  reveal_answers: z.boolean(),
  shuffle_questions: z.boolean(),
  shuffle_options: z.boolean(),
  questions: z.array(DraftQuestionSchema).min(1).max(60),
});

export const AssessmentIdSchema = z.object({
  assessmentId: z.string().min(1),
});

export const ChildIdSchema = z.object({
  studentId: z.string().min(1),
});

export const AttemptIdSchema = z.object({
  attemptId: z.string().min(1),
});

export const SaveAnswersSchema = z.object({
  attemptId: z.string().min(1),
  answers: z
    .record(z.string(), z.string().max(20000))
    .refine((m) => Object.keys(m).length <= 80, "Too many answers"),
});

export const SubmitAttemptSchema = SaveAnswersSchema;

export const MarkAttemptSchema = z.object({
  attemptId: z.string().min(1),
  marks: z
    .array(
      z.object({
        question_id: z.string().min(1),
        points: z.number().min(0).max(100),
        feedback: z.string().trim().max(2000).nullable(),
      }),
    )
    .min(1)
    .max(60),
  finalize: z.boolean(),
});

export const IntegrityEventSchema = z.object({
  attemptId: z.string().min(1),
  event: z.enum([
    "started",
    "resumed",
    "visibility_hidden",
    "visibility_visible",
    "save_failed",
    "submit_attempted",
    "auto_submit",
  ]),
});

export function normalizeShort(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export function shuffle<T>(items: T[], seed: number): T[] {
  const next = items.slice();
  let s = seed || 1;
  for (let i = next.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) continue;
    next[i] = b;
    next[j] = a;
  }
  return next;
}
