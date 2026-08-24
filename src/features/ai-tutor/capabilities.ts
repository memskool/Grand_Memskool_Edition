import type { AiCapability, AiIntent, AssignmentAiPolicy } from "@/types/ai";

export const CAPABILITY_STATUS: Record<AiCapability, { enabled: boolean; notes: string }> = {
  ai_tutor: { enabled: true, notes: "Core tutoring through the Crane5 adapter." },
  ocr: {
    enabled: false,
    notes: "Registered. Crane5 has no published OCR API; EXTRACT_TEXT is rejected until enabled.",
  },
  image_analysis: {
    enabled: true,
    notes: "Images are forwarded to Crane5 only when CRANE5_VISION=true.",
  },
  voice_input: {
    enabled: true,
    notes: "Browser speech-to-text; the gateway receives text only.",
  },
  speech_output: {
    enabled: true,
    notes: "Browser speechSynthesis on explicit user action.",
  },
  learning_memory: { enabled: true, notes: "Minimal educational memory, owner-scoped." },
  document_context: {
    enabled: true,
    notes: "Short authorized excerpts from lessons/assignments/missed work, not full files.",
  },
};

export function capabilityForIntent(intent: AiIntent): AiCapability {
  if (intent === "ANALYZE_IMAGE") return "image_analysis";
  if (intent === "EXTRACT_TEXT") return "ocr";
  if (intent === "VOICE_QUERY") return "voice_input";
  return "ai_tutor";
}

export function assertCapability(intent: AiIntent) {
  const cap = capabilityForIntent(intent);
  if (intent === "EXTRACT_TEXT" && !CAPABILITY_STATUS.ocr.enabled) {
    throw new Error("Image text extraction is not available yet. Type the question instead.");
  }
  if (intent === "ANALYZE_IMAGE" && process.env["CRANE5_VISION"] !== "true") {
    throw new Error("Image analysis is not enabled for this workspace.");
  }
  return cap;
}

export const DEFAULT_ASSIGNMENT_POLICY: AssignmentAiPolicy = "explanation_only";
