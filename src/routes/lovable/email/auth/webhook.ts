import * as React from "react";
import { createAuthEmailHandler } from "@lovable.dev/email-js";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

const SITE_NAME = "Memskool";
const SENDER_DOMAIN = "notify.memskool.com";
const ROOT_DOMAIN = "memskool.com";
const FROM_DOMAIN = "memskool.com";
const SITE_URL = `https://${ROOT_DOMAIN}`;

/**
 * The SDK throws at create time if LOVABLE_API_KEY is missing.
 * TanStack imports this route with the rest of the tree, so that must not
 * take down the landing page on local machines without a Lovable key.
 */
function getHandler() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  const sendUrl = process.env["LOVABLE_SEND_URL"];
  return createAuthEmailHandler({
    apiKey,
    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    senderDomain: SENDER_DOMAIN,
    ...(sendUrl ? { sendUrl } : {}),
    emails: {
      signup: {
        subject: "Confirm your email",
        render: (data) =>
          React.createElement(SignupEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            recipient: data.email,
            confirmationUrl: data.url,
          }),
      },
      invite: {
        subject: "You've been invited",
        render: (data) =>
          React.createElement(InviteEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            confirmationUrl: data.url,
          }),
      },
      magiclink: {
        subject: "Your login link",
        render: (data) =>
          React.createElement(MagicLinkEmail, {
            siteName: SITE_NAME,
            confirmationUrl: data.url,
          }),
      },
      recovery: {
        subject: "Reset your password",
        render: (data) =>
          React.createElement(RecoveryEmail, {
            siteName: SITE_NAME,
            confirmationUrl: data.url,
          }),
      },
      email_change: {
        subject: "Confirm your new email",
        render: (data) =>
          React.createElement(EmailChangeEmail, {
            siteName: SITE_NAME,
            oldEmail: data.old_email ?? "",
            email: data.email,
            newEmail: data.new_email ?? "",
            confirmationUrl: data.url,
          }),
      },
      reauthentication: {
        subject: "Your verification code",
        render: (data) => React.createElement(ReauthenticationEmail, { token: data.token ?? "" }),
      },
    },
  });
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const handler = getHandler();
        if (!handler) {
          return Response.json(
            { error: "Email delivery is not configured on this environment." },
            { status: 503 },
          );
        }
        return handler(request);
      },
    },
  },
});
