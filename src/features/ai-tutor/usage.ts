import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin.server";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { AiCapability } from "@/types/ai";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_IN_WINDOW = 40;

export async function enforceAiRateLimit(userId: string) {
  const ref = adminDb().collection(COLLECTIONS.aiRateLimits).doc(userId);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data() as { window_start?: number; count?: number } | undefined;
    const start = data?.window_start ?? 0;
    const count = data?.count ?? 0;
    if (!snap.exists || now - start > WINDOW_MS) {
      tx.set(ref, {
        owner_id: userId,
        window_start: now,
        count: 1,
        updated_at: new Date().toISOString(),
      });
      return;
    }
    if (count >= MAX_IN_WINDOW) {
      throw new Error("You're sending requests too quickly. Wait a few minutes and try again.");
    }
    tx.update(ref, { count: count + 1, updated_at: new Date().toISOString() });
  });
}

export async function recordAiUsage(input: {
  userId: string;
  schoolId: string | null;
  capability: AiCapability;
  ok: boolean;
  latencyMs: number;
  intent: string;
}) {
  const day = new Date().toISOString().slice(0, 10);
  const id = `${input.userId}_${day}`;
  const ref = adminDb().collection(COLLECTIONS.aiUsage).doc(id);
  await ref.set(
    {
      owner_id: input.userId,
      school_id: input.schoolId,
      day,
      requests: FieldValue.increment(1),
      failures: FieldValue.increment(input.ok ? 0 : 1),
      latency_ms_sum: FieldValue.increment(input.latencyMs),
      last_capability: input.capability,
      last_intent: input.intent,
      last_ok: input.ok,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );
}

export function logAiEvent(event: {
  ok: boolean;
  capability: string;
  intent: string;
  latencyMs: number;
  contextType: string;
}) {
  console.info(
    JSON.stringify({
      src: "ai-gateway",
      ok: event.ok,
      capability: event.capability,
      intent: event.intent,
      latency_ms: event.latencyMs,
      context_type: event.contextType,
    }),
  );
}
