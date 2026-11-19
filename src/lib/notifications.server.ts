/**
 * Server-only notification delivery.
 *
 * In-app `notifications` stay the source of truth. Spark cannot run the
 * Firestore trigger in `functions/`, so callers enqueue `notification_deliveries`
 * with `createAndQueueNotification` and then `dispatchNotifications()`.
 *
 * Guarantees:
 *  - Idempotent: a delivery row is claimed before sending and can only reach
 *    `sent` once; deterministic delivery ids stop duplicate email rows.
 *  - Retry-safe: transient failures get exponential backoff up to MAX_ATTEMPTS.
 *  - Non-blocking: callers use `dispatchNotifications()` fire-and-forget so an
 *    email/SMS outage never fails a payment, grade or application update.
 *  - Never logs credentials, message bodies or student PII beyond an id.
 */

import "@tanstack/react-start/server-only";
import { DeliveryError, emailConfig, sendResendEmail } from "@/lib/mail.server";

const MAX_ATTEMPTS = 4;
const BATCH_SIZE = 25;
const DRAIN_BATCHES = 12;
const AT_API = "https://api.africastalking.com/version1/messaging";

export { DeliveryError, emailConfig };

export type DeliveryRow = {
  id: string;
  notification_id: string;
  user_id: string;
  channel: "email" | "sms";
  destination: string;
  attempts: number;
  next_attempt_at?: string;
  notifications: {
    title: string;
    body: string | null;
    kind: string;
    link: string | null;
  } | null;
};

/* ------------------------------------------------------------------ */
/* Provider configuration                                              */
/* ------------------------------------------------------------------ */

export function smsConfig() {
  const apiKey = process.env["AFRICASTALKING_API_KEY"];
  const username = process.env["AFRICASTALKING_USERNAME"];
  const senderId = process.env["AFRICASTALKING_SENDER_ID"] ?? null;
  return apiKey && username ? { apiKey, username, senderId } : null;
}

export function appOrigin(): string {
  return process.env["APP_ORIGIN"] ?? "https://memskool.com";
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<string, string> = {
  application: "Admissions update",
  discipline: "Behaviour notice",
  payment: "Payment update",
  order: "Order update",
  assessment: "Assessment update",
  academic: "Class update",
  meeting: "School meeting",
  announcement: "School announcement",
  security: "Account security",
  live_class: "Live class",
  missed_work: "Missed work",
  gold: "Gold class",
  message: "New message",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmail(input: {
  title: string;
  body: string | null;
  kind: string;
  link: string | null;
}): { subject: string; html: string; text: string } {
  const label = KIND_LABEL[input.kind] ?? "Memskool";
  const subject = `${label}: ${input.title}`;
  const url = input.link ? `${appOrigin()}${input.link}` : appOrigin();
  const body = input.body ?? "";

  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:'Helvetica Neue',Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e8e6e1">
        <tr><td style="background:#0B1C3A;padding:24px 28px">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.02em">Memskool</span>
          <div style="color:#C4A035;font-size:11px;margin-top:6px;letter-spacing:.16em;text-transform:uppercase">${escapeHtml(label)}</div>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563">${escapeHtml(body)}</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#0B1C3A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600">Open Memskool</a>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eeedf2;font-size:12px;color:#8b8a96">
          You are receiving this because of activity on your Memskool account. Manage email and SMS alerts in Settings.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const text = `${input.title}\n\n${body}\n\n${url}\n\nManage your Memskool alerts in Settings.`;
  return { subject, html, text };
}

/** SMS is charged per 160 chars — keep it short and free of sensitive detail. */
export function renderSms(input: { title: string; body: string | null }): string {
  const raw = `Memskool: ${input.title}${input.body ? ` - ${input.body}` : ""}`;
  return raw.length > 300 ? `${raw.slice(0, 297)}...` : raw;
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

export async function sendEmail(to: string, payload: ReturnType<typeof renderEmail>) {
  return sendResendEmail(to, payload);
}

export async function sendSms(to: string, message: string) {
  const config = smsConfig();
  if (!config) throw new DeliveryError("Africa's Talking credentials are not configured", false);

  const form = new URLSearchParams({ username: config.username, to, message });
  if (config.senderId) form.set("from", config.senderId);

  const response = await fetch(AT_API, {
    method: "POST",
    headers: {
      apiKey: config.apiKey,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: form.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new DeliveryError(`AfricasTalking ${response.status}`, retryable);
  }

  let messageId: string | null = null;
  try {
    const parsed = JSON.parse(text) as {
      SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string }> };
    };
    const recipient = parsed.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.status && recipient.status !== "Success") {
      throw new DeliveryError(`AfricasTalking rejected recipient: ${recipient.status}`, false);
    }
    messageId = recipient?.messageId ?? null;
  } catch (error) {
    if (error instanceof DeliveryError) throw error;
  }
  return messageId;
}

/* ------------------------------------------------------------------ */
/* Worker                                                              */
/* ------------------------------------------------------------------ */

function backoffMinutes(attempts: number) {
  return Math.min(60, 2 ** attempts); // 2, 4, 8, 16 minutes
}

export async function processPendingDeliveries(limit = BATCH_SIZE, opts?: { userId?: string }) {
  const { adminCol, adminGetById, adminUpdate } = await import("@/lib/firebase/admin-repo");
  const { COLLECTIONS } = await import("@/lib/firebase/repo");
  const hasEmail = Boolean(emailConfig());
  const hasSms = Boolean(smsConfig());

  const result = { claimed: 0, sent: 0, failed: 0, skipped: 0 };
  if (!hasEmail && !hasSms) return result;

  const now = new Date().toISOString();
  // Phase 8: optional userId scopes the drain so clients cannot empty the global queue.
  let query = adminCol(COLLECTIONS.notificationDeliveries).where("status", "==", "pending");
  if (opts?.userId) {
    query = query.where("user_id", "==", opts.userId);
  } else {
    query = query.orderBy("created_at", "asc");
  }
  const snap = await query.limit(limit).get();

  const rows = snap.docs
    .map((d) => ({
      ...(d.data() as Omit<DeliveryRow, "id" | "notifications"> & { created_at?: string }),
      id: d.id,
    }))
    .filter((row) => !row.next_attempt_at || row.next_attempt_at <= now)
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))) as Array<
    Omit<DeliveryRow, "notifications"> & { next_attempt_at?: string; created_at?: string }
  >;
  result.claimed = rows.length;

  for (const row of rows) {
    const notification = await adminGetById<{
      title: string;
      body: string | null;
      kind: string;
      link: string | null;
    }>(COLLECTIONS.notifications, row.notification_id);
    if (!notification) {
      await adminUpdate(COLLECTIONS.notificationDeliveries, row.id, {
        status: "skipped",
        error: "notification missing",
      });
      result.skipped += 1;
      continue;
    }

    const configured = row.channel === "email" ? hasEmail : hasSms;
    if (!configured) {
      result.skipped += 1;
      continue;
    }

    const db = (await import("@/lib/firebase/admin.server")).adminDb();
    const claimed = await db.runTransaction(async (tx) => {
      const ref = db.collection(COLLECTIONS.notificationDeliveries).doc(row.id);
      const current = await tx.get(ref);
      const data = current.data();
      if (!data || data["status"] !== "pending" || data["attempts"] !== row.attempts) return false;
      tx.update(ref, {
        attempts: row.attempts + 1,
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
      return true;
    });
    if (!claimed) continue;

    try {
      const providerId =
        row.channel === "email"
          ? await sendEmail(row.destination, renderEmail(notification))
          : await sendSms(row.destination, renderSms(notification));

      await adminUpdate(COLLECTIONS.notificationDeliveries, row.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: providerId,
        error: null,
      });
      result.sent += 1;
    } catch (error) {
      const retryable = error instanceof DeliveryError ? error.retryable : true;
      const attempts = row.attempts + 1;
      const giveUp = !retryable || attempts >= MAX_ATTEMPTS;
      const message = error instanceof Error ? error.message : "unknown error";

      await adminUpdate(COLLECTIONS.notificationDeliveries, row.id, {
        status: giveUp ? "failed" : "pending",
        error: message.slice(0, 300),
        next_attempt_at: new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString(),
      });

      console.error(
        `[notifications] ${row.channel} delivery ${row.id} attempt ${attempts} failed: ${message.slice(0, 200)}`,
      );
      result.failed += 1;
    }
  }

  return result;
}

export async function queueEmailForUser(notificationId: string, userId: string) {
  if (!emailConfig()) return;
  const { adminGetById, adminSet } = await import("@/lib/firebase/admin-repo");
  const { COLLECTIONS } = await import("@/lib/firebase/repo");

  const deliveryId = `${notificationId}_email`;
  const existing = await adminGetById<{ status?: string }>(
    COLLECTIONS.notificationDeliveries,
    deliveryId,
  );
  if (existing?.status === "pending" || existing?.status === "sent") return;

  const prefs = await adminGetById<{ email_enabled?: boolean }>(
    COLLECTIONS.notificationPreferences,
    userId,
  );
  if (prefs?.email_enabled === false) return;

  const user = await adminGetById<{ email?: string | null }>(COLLECTIONS.users, userId);
  let email = user?.email ?? null;
  if (!email) {
    try {
      const rec = await (await import("@/lib/firebase/admin.server")).adminAuth().getUser(userId);
      email = rec.email ?? null;
    } catch {
      return;
    }
  }
  if (!email) return;

  const now = new Date().toISOString();
  await adminSet(COLLECTIONS.notificationDeliveries, deliveryId, {
    notification_id: notificationId,
    user_id: userId,
    channel: "email",
    destination: email,
    status: "pending",
    attempts: 0,
    next_attempt_at: now,
    created_at: now,
  });
}

export type NotificationInput = {
  userId: string;
  title: string;
  body: string | null;
  kind: string;
  link: string | null;
  schoolId?: string | null;
  createdAt?: string;
  /** false skips the email channel (chatty kinds such as direct messages). */
  email?: boolean;
  /** false skips the web push (the caller sends one batched push itself). */
  push?: boolean;
  /** Extra fields stored on the notification row (e.g. dm_conversation_id). */
  extra?: Record<string, unknown>;
};

export async function createAndQueueNotification(input: NotificationInput): Promise<string> {
  const { adminCreate } = await import("@/lib/firebase/admin-repo");
  const { COLLECTIONS } = await import("@/lib/firebase/repo");
  const id = await adminCreate(COLLECTIONS.notifications, {
    ...(input.extra ?? {}),
    user_id: input.userId,
    title: input.title,
    body: input.body,
    kind: input.kind,
    link: input.link,
    read: false,
    school_id: input.schoolId ?? null,
    created_at: input.createdAt ?? new Date().toISOString(),
  });
  if (input.email !== false) await queueEmailForUser(id, input.userId);
  if (input.push !== false) {
    await sendPushToUsers([input.userId], {
      title: input.title,
      body: input.body,
      link: input.link,
    });
  }
  return id;
}

/* ------------------------------------------------------------------ */
/* Web push (FCM)                                                      */
/* ------------------------------------------------------------------ */

const PUSH_TOKEN_QUERY_CHUNK = 30; // Firestore `in` limit
const PUSH_MULTICAST_CHUNK = 500; // FCM multicast limit
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/**
 * Sends a web push to every registered browser of `userIds`. Runs on the app server
 * with the Admin SDK, so it works on the Spark plan (no Cloud Functions). Never throws:
 * push is best-effort on top of the in-app notification, which stays the source of truth.
 * Tokens FCM reports as dead are deleted so they are not retried forever.
 */
export async function sendPushToUsers(
  userIds: string[],
  message: { title: string; body: string | null; link: string | null },
): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return result;
  try {
    const { adminDb, adminMessaging } = await import("@/lib/firebase/admin.server");
    const { COLLECTIONS } = await import("@/lib/firebase/repo");
    const db = adminDb();
    const tokenDocs: Array<{ id: string; token: string }> = [];
    for (let i = 0; i < unique.length; i += PUSH_TOKEN_QUERY_CHUNK) {
      const snap = await db
        .collection(COLLECTIONS.fcmTokens)
        .where("user_id", "in", unique.slice(i, i + PUSH_TOKEN_QUERY_CHUNK))
        .get();
      for (const doc of snap.docs) {
        const token = doc.get("token");
        if (typeof token === "string" && token) tokenDocs.push({ id: doc.id, token });
      }
    }
    if (!tokenDocs.length) return result;

    const link = `${appOrigin()}${message.link ?? "/dashboard"}`;
    for (let i = 0; i < tokenDocs.length; i += PUSH_MULTICAST_CHUNK) {
      const chunk = tokenDocs.slice(i, i + PUSH_MULTICAST_CHUNK);
      const response = await adminMessaging().sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: { title: message.title, ...(message.body ? { body: message.body } : {}) },
        data: { link },
        webpush: {
          notification: { icon: `${appOrigin()}/favicon.png`, badge: `${appOrigin()}/favicon.png` },
          fcmOptions: { link },
        },
      });
      result.sent += response.successCount;
      result.failed += response.failureCount;
      const dead = response.responses
        .map((r, idx) => (!r.success && DEAD_TOKEN_CODES.has(r.error?.code ?? "") ? idx : -1))
        .filter((idx) => idx >= 0);
      await Promise.all(
        dead.map((idx) =>
          db
            .collection(COLLECTIONS.fcmTokens)
            .doc(chunk[idx]!.id)
            .delete()
            .catch(() => undefined),
        ),
      );
    }
  } catch (error) {
    console.error(
      "[notifications] push failed:",
      error instanceof Error ? error.message.slice(0, 200) : "unknown error",
    );
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Fan-out                                                             */
/* ------------------------------------------------------------------ */

const FANOUT_CONCURRENCY = 25;
/** Hard ceiling so a runaway caller cannot spam a whole tenant; well above any class size. */
const FANOUT_MAX_RECIPIENTS = 5000;

/**
 * Notifies every recipient (no 80-person cap): in-app row + email for each, then one
 * batched web push for the whole group, then a delivery drain. Recipients are de-duplicated
 * and processed in bounded parallel chunks. Returns how many rows were written.
 */
export async function notifyUsers(
  userIds: string[],
  input: Omit<NotificationInput, "userId" | "push">,
): Promise<number> {
  const unique = [...new Set(userIds.filter(Boolean))].slice(0, FANOUT_MAX_RECIPIENTS);
  if (!unique.length) return 0;
  const createdAt = input.createdAt ?? new Date().toISOString();
  let written = 0;
  for (let i = 0; i < unique.length; i += FANOUT_CONCURRENCY) {
    const chunk = unique.slice(i, i + FANOUT_CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((userId) =>
        createAndQueueNotification({ ...input, userId, createdAt, push: false }),
      ),
    );
    written += settled.filter((r) => r.status === "fulfilled").length;
    for (const r of settled) {
      if (r.status === "rejected") {
        console.error(
          "[notifications] fan-out row failed:",
          r.reason instanceof Error ? r.reason.message.slice(0, 200) : "unknown error",
        );
      }
    }
  }
  await sendPushToUsers(unique, { title: input.title, body: input.body, link: input.link });
  void dispatchNotifications(unique.length);
  return written;
}

/**
 * Fire-and-forget drain used right after a server-side action created
 * notifications. Never rejects, so it can't break the calling operation.
 */
export function dispatchNotifications(limit = BATCH_SIZE): Promise<void> {
  return (async () => {
    const batches = Math.max(1, Math.ceil(limit / BATCH_SIZE), DRAIN_BATCHES);
    for (let i = 0; i < batches; i += 1) {
      const result = await processPendingDeliveries(BATCH_SIZE);
      if (result.claimed === 0) break;
    }
  })().catch((error: unknown) => {
    console.error(
      "[notifications] dispatch failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  });
}
