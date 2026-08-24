export const AI_INTENTS = [
  "CHAT",
  "EXPLAIN",
  "TEACH",
  "SOLVE",
  "REVISE",
  "ANALYZE_IMAGE",
  "EXTRACT_TEXT",
  "VOICE_QUERY",
  "ASSIGNMENT_HELP",
  "MISSED_WORK_HELP",
] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

export const AI_CAPABILITIES = [
  "ai_tutor",
  "ocr",
  "image_analysis",
  "voice_input",
  "speech_output",
  "learning_memory",
  "document_context",
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];

export const ASSIGNMENT_AI_POLICIES = [
  "assistance_allowed",
  "explanation_only",
  "no_direct_answers",
  "disabled",
] as const;
export type AssignmentAiPolicy = (typeof ASSIGNMENT_AI_POLICIES)[number];

export type AiConversation = {
  id: string;
  owner_id: string;
  school_id: string | null;
  title: string;
  subject_id: string | null;
  context_type: "general" | "lesson" | "assignment" | "missed_work" | "subject";
  created_at: string;
  updated_at: string;
  last_activity_at: string;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  owner_id: string;
  role: "user" | "assistant";
  content: string;
  intent: AiIntent | null;
  capability: AiCapability;
  status: "complete" | "failed";
  created_at: string;
};

export type AiMemoryItem = {
  id: string;
  owner_id: string;
  school_id: string | null;
  kind: "struggle" | "goal" | "summary" | "preference" | "topic";
  topic: string | null;
  body: string;
  created_at: string;
};
