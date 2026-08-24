import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/app/PublicLayout";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacy — Memskool" },
      {
        name: "description",
        content: "How Memskool handles account, school, and learning data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicLayout>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated 22 August 2026. This is a product notice, not legal advice.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p>
          Memskool is a school workspace. We store the information needed to run accounts, classes,
          assessments, live lessons, and school administration.
        </p>
        <h2 className="font-display text-lg font-semibold">What we store</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Account details you provide (name, email, role, optional phone and photo).</li>
          <li>School membership, classes, attendance, assignments, and assessment attempts.</li>
          <li>
            Files you upload to lockers, lessons, or submissions (size and type limits apply).
          </li>
          <li>Messages you send inside the product, and in-app notifications.</li>
          <li>AI Tutor prompts and replies for your own conversations, plus usage counters.</li>
        </ul>
        <h2 className="font-display text-lg font-semibold">Who can see school data</h2>
        <p className="text-muted-foreground">
          Access is limited by school and role. Students see their own work. Teachers and school
          administrators see records for their school. Parents see only children a school
          administrator has linked, and only released assessment scores. Platform operators cannot
          browse another school’s classrooms or marks from the superadmin dashboard.
        </p>
        <h2 className="font-display text-lg font-semibold">Processors</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            Google Firebase (Authentication, Firestore, Storage, optional Analytics and Cloud
            Messaging).
          </li>
          <li>Crane5 for the AI Tutor when that service is configured.</li>
          <li>LiveKit for live classroom audio and video when that service is configured.</li>
          <li>Flutterwave for marketplace payments when that service is configured.</li>
        </ul>
        <h2 className="font-display text-lg font-semibold">Analytics</h2>
        <p className="text-muted-foreground">
          If a Firebase measurement ID is configured, Memskool may record a small set of product
          events (workspace open, assessment submitted, classroom join). Events do not include
          lesson text, answers, or email addresses.
        </p>
        <h2 className="font-display text-lg font-semibold">Contact</h2>
        <p className="text-muted-foreground">
          Questions:{" "}
          <a className="underline-offset-2 hover:underline" href="mailto:memskool@gmail.com">
            memskool@gmail.com
          </a>
          .
        </p>
      </div>
    </PublicLayout>
  );
}
