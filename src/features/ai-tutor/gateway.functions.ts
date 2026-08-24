import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth, type AuthedContext } from "@/lib/firebase/require-auth";
import {
  adminCreate,
  adminDelete,
  adminGetById,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import {
  ConversationIdSchema,
  MemoryIdSchema,
  MemorySaveSchema,
  RenameConversationSchema,
  TutorTurnSchema,
} from "./contracts";
import { assertCapability } from "./capabilities";
import { assembleContext } from "./context";
import { buildInstructions } from "./instructions";
import { callCrane5, type Crane5Message } from "./crane5";
import { enforceAiRateLimit, logAiEvent, recordAiUsage } from "./usage";

const TUTOR_ROLES = new Set(["student", "teacher", "admin"]);

function requireTutor(context: AuthedContext) {
  if (!TUTOR_ROLES.has(context.role)) {
    throw new Error("The AI Tutor is available to students and teachers.");
  }
  if (context.role === "teacher" && !context.approved) {
    throw new Error("Your school has not approved your teacher account yet.");
  }
}

async function loadHistory(conversationId: string, ownerId: string): Promise<Crane5Message[]> {
  const rows = await adminWhere<{
    owner_id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
    status?: string;
  }>(COLLECTIONS.aiMessages, "conversation_id", "==", conversationId);
  return rows
    .filter((r) => r.owner_id === ownerId && r.status !== "failed")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-12)
    .map((r) => ({ role: r.role, content: r.content }));
}

export const sendTutorTurn = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => TutorTurnSchema.parse(data))
  .handler(async ({ data, context }) => {
    requireTutor(context);
    const { crane5Configured } = await import("./crane5");
    if (!crane5Configured()) {
      throw new Error("The tutor is not connected yet. Lessons, locker and live class still work.");
    }
    const capability = assertCapability(data.intent);
    await enforceAiRateLimit(context.userId);

    const packed = await assembleContext(context, data);
    let conversationId = data.conversation_id;
    const now = new Date().toISOString();

    if (conversationId) {
      const conv = await adminGetById<{ owner_id: string }>(
        COLLECTIONS.aiConversations,
        conversationId,
      );
      if (!conv || conv.owner_id !== context.userId) {
        throw new Error("That conversation was not found.");
      }
    } else {
      conversationId = await adminCreate(COLLECTIONS.aiConversations, {
        owner_id: context.userId,
        school_id: context.schoolId,
        title: data.message.slice(0, 72),
        subject_id: packed.subjectId,
        context_type: packed.contextType,
        created_at: now,
        updated_at: now,
        last_activity_at: now,
      });
    }

    const history = await loadHistory(conversationId, context.userId);
    const system = buildInstructions({
      intent: data.intent,
      role: context.role,
      assignmentPolicy: packed.assignmentPolicy,
    });
    const userContent = data.image_path
      ? `${data.message}\n\n[Attached learning image path: ${data.image_path}]`
      : data.message;

    const started = Date.now();
    try {
      const result = await callCrane5({
        messages: [
          {
            role: "system",
            content: `${system}\n\nAuthorized educational context:\n${packed.text}`,
          },
          ...history,
          { role: "user", content: userContent },
        ],
      });
      await adminCreate(COLLECTIONS.aiMessages, {
        conversation_id: conversationId,
        owner_id: context.userId,
        role: "user",
        content: data.message,
        intent: data.intent,
        capability,
        status: "complete",
        created_at: now,
      });
      const assistantAt = new Date().toISOString();
      await adminCreate(COLLECTIONS.aiMessages, {
        conversation_id: conversationId,
        owner_id: context.userId,
        role: "assistant",
        content: result.text,
        intent: data.intent,
        capability,
        status: "complete",
        created_at: assistantAt,
      });
      await adminUpdate(COLLECTIONS.aiConversations, conversationId, {
        updated_at: assistantAt,
        last_activity_at: assistantAt,
      });
      const latency = result.latencyMs || Date.now() - started;
      await recordAiUsage({
        userId: context.userId,
        schoolId: context.schoolId,
        capability,
        ok: true,
        latencyMs: latency,
        intent: data.intent,
      });
      logAiEvent({
        ok: true,
        capability,
        intent: data.intent,
        latencyMs: latency,
        contextType: packed.contextType,
      });
      return {
        conversation_id: conversationId,
        reply: result.text,
        context_label: packed.label,
        streamed: result.streamed,
      };
    } catch (error) {
      const latency = Date.now() - started;
      await recordAiUsage({
        userId: context.userId,
        schoolId: context.schoolId,
        capability,
        ok: false,
        latencyMs: latency,
        intent: data.intent,
      });
      logAiEvent({
        ok: false,
        capability,
        intent: data.intent,
        latencyMs: latency,
        contextType: packed.contextType,
      });
      throw error;
    }
  });

export const listAiConversations = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    requireTutor(context);
    const rows = await adminWhere<{
      owner_id: string;
      title: string;
      context_type: string;
      last_activity_at: string;
      subject_id?: string | null;
    }>(COLLECTIONS.aiConversations, "owner_id", "==", context.userId);
    return rows
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
      .slice(0, 40)
      .map((r) => ({
        id: r.id,
        title: r.title,
        context_type: r.context_type,
        last_activity_at: r.last_activity_at,
        subject_id: r.subject_id ?? null,
      }));
  });

export const listAiMessages = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => ConversationIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    requireTutor(context);
    const conv = await adminGetById<{ owner_id: string }>(
      COLLECTIONS.aiConversations,
      data.conversation_id,
    );
    if (!conv || conv.owner_id !== context.userId)
      throw new Error("That conversation was not found.");
    const rows = await adminWhere<{
      owner_id: string;
      role: "user" | "assistant";
      content: string;
      created_at: string;
      status?: string;
    }>(COLLECTIONS.aiMessages, "conversation_id", "==", data.conversation_id);
    return rows
      .filter((r) => r.owner_id === context.userId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        created_at: r.created_at,
        status: r.status ?? "complete",
      }));
  });

export const deleteAiConversation = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => ConversationIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    requireTutor(context);
    const conv = await adminGetById<{ owner_id: string }>(
      COLLECTIONS.aiConversations,
      data.conversation_id,
    );
    if (!conv || conv.owner_id !== context.userId)
      throw new Error("That conversation was not found.");
    const msgs = await adminWhere<{ id: string }>(
      COLLECTIONS.aiMessages,
      "conversation_id",
      "==",
      data.conversation_id,
    );
    await Promise.all(msgs.map((m) => adminDelete(COLLECTIONS.aiMessages, m.id)));
    await adminDelete(COLLECTIONS.aiConversations, data.conversation_id);
    return { ok: true as const };
  });

export const renameAiConversation = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => RenameConversationSchema.parse(data))
  .handler(async ({ data, context }) => {
    requireTutor(context);
    const conv = await adminGetById<{ owner_id: string }>(
      COLLECTIONS.aiConversations,
      data.conversation_id,
    );
    if (!conv || conv.owner_id !== context.userId)
      throw new Error("That conversation was not found.");
    await adminUpdate(COLLECTIONS.aiConversations, data.conversation_id, {
      title: data.title,
      updated_at: new Date().toISOString(),
    });
    return { ok: true as const };
  });

export const saveAiMemory = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => MemorySaveSchema.parse(data))
  .handler(async ({ data, context }) => {
    requireTutor(context);
    const id = await adminCreate(COLLECTIONS.aiLearningMemory, {
      owner_id: context.userId,
      school_id: context.schoolId,
      kind: data.kind,
      topic: data.topic,
      body: data.body,
      created_at: new Date().toISOString(),
    });
    return { id };
  });

export const deleteAiMemory = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => MemoryIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    requireTutor(context);
    const row = await adminGetById<{ owner_id: string }>(COLLECTIONS.aiLearningMemory, data.id);
    if (!row || row.owner_id !== context.userId) throw new Error("That memory was not found.");
    await adminDelete(COLLECTIONS.aiLearningMemory, data.id);
    return { ok: true as const };
  });

export const listAiMemory = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    requireTutor(context);
    const rows = await adminWhere<{
      kind: string;
      topic?: string | null;
      body: string;
      created_at: string;
      owner_id: string;
    }>(COLLECTIONS.aiLearningMemory, "owner_id", "==", context.userId);
    return rows
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 40)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        topic: r.topic ?? null,
        body: r.body,
        created_at: r.created_at,
      }));
  });
