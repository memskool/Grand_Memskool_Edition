import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface EmailChangeEmailProps {
  siteName: string;
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm your email change</Heading>
        <Text style={text}>
          You requested to change your email address for {siteName} from{" "}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{" "}
          to{" "}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>Click the button below to confirm this change:</Text>
        <Button style={button} href={confirmationUrl}>
          Confirm Email Change
        </Button>
        <Text style={footer}>
          If you didn't request this change, please secure your account immediately.
        </Text>
        <Text style={brandFooter}>
          Memskool — a product of Mem-Industries in partnership with Altrastate Technologies Ltd.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" };
const container = {
  padding: "32px 28px",
  maxWidth: "520px",
  margin: "0 auto",
  border: "1px solid #ece9f8",
  borderRadius: "20px",
};
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#1b1533",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#57536e",
  lineHeight: "1.5",
  margin: "0 0 25px",
};
const link = { color: "#4a34b8", textDecoration: "underline" };
const button = {
  backgroundColor: "#4a34b8",
  color: "#ffffff",
  fontSize: "14px",
  borderRadius: "999px",
  padding: "13px 26px",
  fontWeight: 600 as const,
  textDecoration: "none",
};
const footer = { fontSize: "12px", color: "#8b87a3", margin: "30px 0 0" };

const brandFooter = {
  fontSize: "11px",
  color: "#8b87a3",
  lineHeight: "1.6",
  margin: "28px 0 0",
  borderTop: "1px solid #ece9f8",
  paddingTop: "14px",
};
