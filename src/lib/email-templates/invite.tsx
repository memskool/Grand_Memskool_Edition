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

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{" "}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept the invitation and create your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
        <Text style={brandFooter}>
          Memskool — a product of Mem-Industries in partnership with Altrastate Technologies Ltd.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default InviteEmail;

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
