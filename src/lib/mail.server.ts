import "@tanstack/react-start/server-only";

const RESEND_API = "https://api.resend.com/emails";

export class DeliveryError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.retryable = retryable;
  }
}

export function emailConfig() {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"] ?? "Memskool <notifications@memskool.com>";
  return apiKey ? { apiKey, from } : null;
}

export function resolveMailOrigin(candidate: string): string {
  let origin: string;
  try {
    origin = new URL(candidate).origin;
  } catch {
    throw new Error("That link origin is not valid.");
  }
  if (isTrustedDevOrigin(origin)) return origin;
  const allowed = new Set<string>(["https://memskool.com", "https://www.memskool.com"]);
  const app = process.env["APP_ORIGIN"];
  if (app) {
    try {
      allowed.add(new URL(app).origin);
    } catch {
      /* ignore malformed APP_ORIGIN */
    }
  }
  if (!allowed.has(origin)) throw new Error("That link origin is not allowed.");
  return origin;
}

function isTrustedDevOrigin(origin: string): boolean {
  const url = new URL(origin);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match) {
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

/** Continue URL for Firebase Admin action links — must be an authorized domain. */
export function firebaseContinueOrigin(): string {
  const app = process.env["APP_ORIGIN"];
  if (app) {
    try {
      return new URL(app).origin;
    } catch {
      /* fall through */
    }
  }
  return "https://memskool-4e193.firebaseapp.com";
}

export function brandedActionLink(firebaseLink: string, origin: string, path: string): string {
  const parsed = new URL(firebaseLink);
  const oobCode = parsed.searchParams.get("oobCode");
  if (!oobCode) return firebaseLink;
  return `${origin}${path}?oobCode=${encodeURIComponent(oobCode)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAuthEmail(input: {
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
}): { subject: string; html: string; text: string } {
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:'Helvetica Neue',Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e8e6e1">
        <tr><td style="background:#0B1C3A;padding:24px 28px">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.02em">Memskool</span>
          <div style="color:#C4A035;font-size:11px;margin-top:6px;letter-spacing:.16em;text-transform:uppercase">Institute</div>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(input.heading)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563">${escapeHtml(input.body)}</p>
          <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#0B1C3A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600">${escapeHtml(input.actionLabel)}</a>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eeedf2;font-size:12px;color:#8b8a96">
          If you did not request this, you can ignore the email.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
  const text = `${input.heading}\n\n${input.body}\n\n${input.actionUrl}\n`;
  return { subject: input.heading, html, text };
}

export async function sendResendEmail(
  to: string,
  payload: { subject: string; html: string; text: string },
) {
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
    const retryable = response.status === 429 || response.status >= 500;
    throw new DeliveryError(
      `Resend ${response.status}: ${json.message ?? "send failed"}`,
      retryable,
    );
  }
  return json.id ?? null;
}
