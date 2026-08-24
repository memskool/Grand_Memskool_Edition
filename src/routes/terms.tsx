import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/app/PublicLayout";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terms — Memskool" },
      {
        name: "description",
        content: "Terms of use for the Memskool school workspace.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicLayout>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Terms of use</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated 22 August 2026. This is a product notice, not legal advice.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <p className="text-muted-foreground">
          Memskool is provided by Mem-Industries in partnership with Altrastate Technologies Ltd. By
          creating an account you agree to use the product for legitimate school work only.
        </p>
        <h2 className="font-display text-lg font-semibold">Accounts and schools</h2>
        <p className="text-muted-foreground">
          Your role (student, teacher, parent, or administrator) is assigned during signup and
          enforced by the school. Teachers may need school approval before teaching tools unlock.
          Parents cannot link themselves to a student; a school administrator must create that link.
        </p>
        <h2 className="font-display text-lg font-semibold">Assessments and academic integrity</h2>
        <p className="text-muted-foreground">
          Timed assessments, submissions, and published results are school records. Do not share
          exam content or attempt to change marks outside the school’s marking tools.
        </p>
        <h2 className="font-display text-lg font-semibold">AI Tutor</h2>
        <p className="text-muted-foreground">
          The AI Tutor is a study aid. It can be wrong. It is not an official mark, a teacher
          substitute, or a source you should treat as automatically authoritative.
        </p>
        <h2 className="font-display text-lg font-semibold">Live classes</h2>
        <p className="text-muted-foreground">
          Camera and microphone access are granted by your browser. Live video needs a working
          connection. If permissions are denied or the network is poor, the product will say so
          rather than pretending the class is running normally.
        </p>
        <h2 className="font-display text-lg font-semibold">Availability</h2>
        <p className="text-muted-foreground">
          Features that need third-party keys (AI, live video, payments) only work when the school
          or platform has configured them. We may change or pause the service for maintenance.
        </p>
        <h2 className="font-display text-lg font-semibold">Contact</h2>
        <p className="text-muted-foreground">
          <a className="underline-offset-2 hover:underline" href="mailto:memskool@gmail.com">
            memskool@gmail.com
          </a>
        </p>
      </div>
    </PublicLayout>
  );
}
