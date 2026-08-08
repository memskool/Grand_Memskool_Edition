/**
 * Server-only notification delivery.
 *
 * The `notifications` table stays the single source of truth: a database
 * trigger fans every new notification out into `notification_deliveries`
 * rows (one per channel, unique per notification+channel). This module is the
 * worker that drains those rows through Resend (email) and Africa's Talking
 * (SMS).
 *
 * Guarantees:
 *  - Idempotent: a delivery row is claimed before sending and can only reach
 *    `sent` once; the unique (notification_id, channel) index stops duplicates
 *    even if an upstream event is replayed.
 *  - Retry-safe: transient failures get exponential backoff up to MAX_ATTEMPTS.
 *  - Non-blocking: callers use `dispatchNotifications()` fire-and-forget so an
 *    email/SMS outage never fails a payment, grade or application update.
 *  - Never logs credentials, message bodies or student PII beyond an id.
 */

const MAX_ATTEMPTS = 4;
const BATCH_SIZE = 25;
const RESEND_API = "https://api.resend.com/emails";
const AT_API = "https://api.africastalking.com/version1/messaging";

export type DeliveryRow = {
  id: string;
  notification_id: string;
  user_id: string;
  channel: "email" | "sms";
  destination: string;
  attempts: number;
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

export function emailConfig() {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"] ?? "Memskool <notifications@memskool.com>";
  return apiKey ? { apiKey, from } : null;
}

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
  meeting: "School meeting",
  announcement: "School announcement",
  security: "Account security",
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

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:'Helvetica Neue',Arial,sans-serif;color:#1c1b22">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(30,20,70,.08)">
        <tr><td style="background:linear-gradient(120deg,#4c1d95,#0f766e);padding:24px 28px">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.02em">Memskool</span>
          <div style="color:#e9d5ff;font-size:12px;margin-top:4px">${escapeHtml(label)}</div>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b4a55">${escapeHtml(body)}</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#4c1d95;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600">Open Memskool</a>
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

export class DeliveryError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.retryable = retryable;
  }
}

export async function sendEmail(to: string, payload: ReturnType<typeof renderEmail>) {
  const config = emailConfig();
  if (!config) throw new DeliveryError("RESEND_API_KEY is not configured", false);

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    // 4xx (bad address, unverified domain) is permanent; 429/5xx is retryable.
    const retryable = response.status === 429 || response.status >= 500;
    throw new DeliveryError(
      `Resend ${response.status}: ${json.message ?? "send failed"}`,
      retryable,
    );
  }
  return json.id ?? null;
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

export async function processPendingDeliveries(limit = BATCH_SIZE) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hasEmail = Boolean(emailConfig());
  const hasSms = Boolean(smsConfig());

  const result = { claimed: 0, sent: 0, failed: 0, skipped: 0 };
  if (!hasEmail && !hasSms) return result;

  const { data, error } = await supabaseAdmin
    .from("notification_deliveries")
    .select(
      "id, notification_id, user_id, channel, destination, attempts, notifications(title, body, kind, link)",
    )
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[notifications] could not load queue:", error.message);
    return result;
  }

  const rows = (data ?? []) as unknown as DeliveryRow[];
  result.claimed = rows.length;

  for (const row of rows) {
    const notification = row.notifications;
    if (!notification) {
      await supabaseAdmin
        .from("notification_deliveries")
        .update({ status: "skipped", error: "notification missing" })
        .eq("id", row.id);
      result.skipped += 1;
      continue;
    }

    const configured = row.channel === "email" ? hasEmail : hasSms;
    if (!configured) {
      result.skipped += 1;
      continue;
    }

    // Claim: only one worker can move a row out of `pending`.
    const { data: claimed } = await supabaseAdmin
      .from("notification_deliveries")
      .update({
        attempts: row.attempts + 1,
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .eq("attempts", row.attempts)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const providerId =
        row.channel === "email"
          ? await sendEmail(row.destination, renderEmail(notification))
          : await sendSms(row.destination, renderSms(notification));

      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: providerId,
          error: null,
        })
        .eq("id", row.id);
      result.sent += 1;
    } catch (error) {
      const retryable = error instanceof DeliveryError ? error.retryable : true;
      const attempts = row.attempts + 1;
      const giveUp = !retryable || attempts >= MAX_ATTEMPTS;
      const message = error instanceof Error ? error.message : "unknown error";

      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: giveUp ? "failed" : "pending",
          error: message.slice(0, 300),
          next_attempt_at: new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString(),
        })
        .eq("id", row.id);

      // Log the channel + delivery id only — never the recipient or body.
      console.error(
        `[notifications] ${row.channel} delivery ${row.id} attempt ${attempts} failed: ${message.slice(0, 200)}`,
      );
      result.failed += 1;
    }
  }

  return result;
}

/**
 * Fire-and-forget drain used right after a server-side action created
 * notifications. Never rejects, so it can't break the calling operation.
 */
export function dispatchNotifications(limit = BATCH_SIZE): Promise<void> {
  return processPendingDeliveries(limit)
    .then(() => undefined)
    .catch((error: unknown) => {
      console.error(
        "[notifications] dispatch failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    });
}
