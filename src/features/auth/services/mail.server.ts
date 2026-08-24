import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import {
  brandedActionLink,
  emailConfig,
  firebaseContinueOrigin,
  renderAuthEmail,
  resolveMailOrigin,
  sendResendEmail,
} from "@/lib/mail.server";

const VERIFY_COOLDOWN_MS = 30_000;
const RESET_COOLDOWN_MS = 60_000;

function emailLockId(prefix: string, email: string) {
  return `${prefix}_${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32)}`;
}

async function recentlyLocked(id: string, cooldownMs: number): Promise<boolean> {
  const { adminGetById, adminSet } = await import("@/lib/firebase/admin-repo");
  const lock = await adminGetById<{ last_at?: string }>("ops_locks", id);
  if (lock?.last_at && Date.now() - Date.parse(lock.last_at) < cooldownMs) return true;
  await adminSet("ops_locks", id, { last_at: new Date().toISOString() });
  return false;
}

export async function sendVerificationEmailHandler({
  data,
  context,
}: {
  data: { origin: string };
  context: AuthedContext;
}): Promise<{ ok: true; alreadyVerified?: boolean }> {
  if (!emailConfig()) {
    throw new Error("Email sending is not configured yet. Add RESEND_API_KEY on the server.");
  }
  const origin = resolveMailOrigin(data.origin);
  const { adminAuth } = await import("@/lib/firebase/admin.server");
  const record = await adminAuth().getUser(context.userId);
  const email = record.email ?? context.email;
  if (!email) throw new Error("This account has no email address to confirm.");
  if (record.emailVerified) return { ok: true, alreadyVerified: true };

  if (await recentlyLocked(`verifymail_${context.userId}`, VERIFY_COOLDOWN_MS)) {
    return { ok: true };
  }

  const firebaseLink = await adminAuth().generateEmailVerificationLink(email, {
    url: `${firebaseContinueOrigin()}/dashboard`,
    handleCodeInApp: false,
  });
  const actionUrl = brandedActionLink(firebaseLink, origin, "/verify-email");
  await sendResendEmail(
    email,
    renderAuthEmail({
      heading: "Confirm your Memskool email",
      body: "Tap the button to confirm this address. That lets us recover your account if you forget the password.",
      actionLabel: "Confirm email",
      actionUrl,
    }),
  );
  return { ok: true };
}

export async function sendPasswordResetMailHandler({
  data,
}: {
  data: { email: string; origin: string };
}): Promise<{ ok: true }> {
  const email = data.email.trim().toLowerCase();
  try {
    if (!emailConfig()) return { ok: true };
    const origin = resolveMailOrigin(data.origin);
    if (await recentlyLocked(emailLockId("pwdreset", email), RESET_COOLDOWN_MS)) {
      return { ok: true };
    }

    const { adminAuth } = await import("@/lib/firebase/admin.server");
    const firebaseLink = await adminAuth().generatePasswordResetLink(email, {
      url: `${firebaseContinueOrigin()}/reset-password`,
      handleCodeInApp: false,
    });
    const actionUrl = brandedActionLink(firebaseLink, origin, "/reset-password");
    await sendResendEmail(
      email,
      renderAuthEmail({
        heading: "Reset your Memskool password",
        body: "Tap the button to choose a new password. The link expires after a short time.",
        actionLabel: "Reset password",
        actionUrl,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/user-not-found|no user record|email-not-found/i.test(message)) {
      console.error("[mail] password reset send failed:", message.slice(0, 200));
    }
  }
  return { ok: true };
}
