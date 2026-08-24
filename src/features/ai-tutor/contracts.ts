import { z } from "zod";
import { AI_INTENTS } from "@/types/ai";

export const TutorTurnSchema = z.object({
  intent: z.enum(AI_INTENTS),
  message: z.string().trim().min(1).max(8000),
  conversation_id: z.string().min(1).nullable(),
  subject_id: z.string().min(1).nullable(),
  lesson_id: z.string().min(1).nullable(),
  assignment_id: z.string().min(1).nullable(),
  missed_work_id: z.string().min(1).nullable(),
  topic_id: z.string().min(1).nullable(),
  image_path: z.string().max(1024).nullable(),
});

export type TutorTurnInput = z.infer<typeof TutorTurnSchema>;

export const ConversationIdSchema = z.object({
  conversation_id: z.string().min(1),
});

export const MemorySaveSchema = z.object({
  kind: z.enum(["struggle", "goal", "summary", "preference", "topic"]),
  topic: z.string().trim().max(120).nullable(),
  body: z.string().trim().min(1).max(1000),
});

export const MemoryIdSchema = z.object({ id: z.string().min(1) });

export const RenameConversationSchema = z.object({
  conversation_id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
});
