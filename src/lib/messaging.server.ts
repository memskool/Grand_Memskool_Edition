import "@tanstack/react-start/server-only";
import { adminCol, adminGetById, adminUpdate } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";

/** A burst of messages in one conversation folds into one unread notification. */
const DM_FOLD_WINDOW_MS = 10 * 60_000;
/** Only fresh messages notify, so an old message id cannot be replayed to spam people. */
const DM_MAX_AGE_MS = 2 * 60_000;
const PREVIEW_CHARS = 120;

type MessageDoc = {
  conversation_id: string;
  sender_id: string;
  body?: string | null;
  created_at?: string;
  notified_at?: string | null;
};

type ConversationDoc = {
  kind?: string;
  title?: string | null;
  created_by?: string;
  member_ids?: string[];
};

function preview(body: string | null | undefined): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Sent you a message";
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 1)}…` : text;
}

async function recipientSilenced(recipientId: string, senderId: string): Promise<boolean> {
  const snap = await adminCol(COLLECTIONS.userRelations)
    .where("user_id", "==", recipientId)
    .where("target_id", "==", senderId)
    .get();
  return snap.docs.some((d) => {
    const relation = d.get("relation");
    return relation === "mute" || relation === "block";
  });
}

/**
 * Tells the other members of a conversation that a message arrived (in-app + web push;
 * no email, chat is too chatty for inboxes). Called by the sender right after the
 * message is written. Safe to call twice: the message is stamped `notified_at` once.
 */
export async function notifyNewMessage(input: {
  messageId: string;
  callerId: string;
}): Promise<{ notified: number }> {
  const message = await adminGetById<MessageDoc>(COLLECTIONS.messages, input.messageId);
  if (!message || message.sender_id !== input.callerId) {
    throw new Error("That message was not found.");
  }
  if (message.notified_at) return { notified: 0 };
  const sentAt = Date.parse(message.created_at ?? "");
  if (!Number.isFinite(sentAt) || Date.now() - sentAt > DM_MAX_AGE_MS) return { notified: 0 };

  const conversation = await adminGetById<ConversationDoc>(
    COLLECTIONS.conversations,
    message.conversation_id,
  );
  if (!conversation) return { notified: 0 };
  const members = new Set(conversation.member_ids ?? []);
  if (!members.size) {
    // Older conversations keep membership only in conversation_members.
    const rows = await adminCol(COLLECTIONS.conversationMembers)
      .where("conversation_id", "==", message.conversation_id)
      .get();
    for (const d of rows.docs) {
      const id = d.get("user_id");
      if (typeof id === "string") members.add(id);
    }
  }
  if (!members.has(input.callerId) && conversation.created_by !== input.callerId) {
    throw new Error("You are not in that conversation.");
  }

  const now = new Date().toISOString();
  await adminUpdate(COLLECTIONS.messages, input.messageId, { notified_at: now });

  const sender = await adminGetById<{ full_name?: string; school_id?: string | null }>(
    COLLECTIONS.users,
    input.callerId,
  );
  const senderName = sender?.full_name?.trim() || "Someone";
  const title = conversation.title
    ? `${senderName} in ${conversation.title}`
    : `New message from ${senderName}`;
  const body = preview(message.body);
  const link = `/messages?c=${encodeURIComponent(message.conversation_id)}`;

  const { createAndQueueNotification, sendPushToUsers } =
    await import("@/lib/notifications.server");
  const recipients = [...members].filter((id) => id && id !== input.callerId);
  let notified = 0;
  await Promise.all(
    recipients.map(async (userId) => {
      try {
        if (await recipientSilenced(userId, input.callerId)) return;
        // Fold a burst into the recipient's latest unread notification for this chat.
        const existing = await adminCol(COLLECTIONS.notifications)
          .where("user_id", "==", userId)
          .where("dm_conversation_id", "==", message.conversation_id)
          .where("read", "==", false)
          .limit(5)
          .get();
        const recent = existing.docs.find(
          (d) => Date.now() - Date.parse(String(d.get("created_at") ?? "")) < DM_FOLD_WINDOW_MS,
        );
        if (recent) {
          await recent.ref.update({ title, body, link, created_at: now });
          await sendPushToUsers([userId], { title, body, link });
        } else {
          await createAndQueueNotification({
            userId,
            title,
            body,
            kind: "message",
            link,
            schoolId: sender?.school_id ?? null,
            createdAt: now,
            email: false,
            extra: { dm_conversation_id: message.conversation_id },
          });
        }
        notified += 1;
      } catch (error) {
        console.error(
          "[messaging] notify failed:",
          error instanceof Error ? error.message.slice(0, 200) : "unknown error",
        );
      }
    }),
  );
  return { notified };
}
