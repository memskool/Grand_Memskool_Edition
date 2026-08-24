import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useExamMode } from "@/lib/exam-mode";
import { AiTutorChat, type TutorLaunch } from "@/components/app/AiTutorChat";
import { ServiceNotice } from "@/components/app/primitives";
import { usePlatformCapabilities } from "@/hooks/usePlatformCapabilities";
import type { AiIntent } from "@/types/ai";
import { AI_INTENTS } from "@/types/ai";

type TutorSearch = {
  lesson?: string | undefined;
  assignment?: string | undefined;
  missed?: string | undefined;
  subject?: string | undefined;
  intent?: string | undefined;
};

function parseTutorSearch(search: Record<string, unknown>): TutorSearch {
  const str = (key: string) =>
    typeof search[key] === "string" ? (search[key] as string) : undefined;
  return {
    ...(str("lesson") ? { lesson: str("lesson") } : {}),
    ...(str("assignment") ? { assignment: str("assignment") } : {}),
    ...(str("missed") ? { missed: str("missed") } : {}),
    ...(str("subject") ? { subject: str("subject") } : {}),
    ...(str("intent") ? { intent: str("intent") } : {}),
  };
}

export const Route = createFileRoute("/_authenticated/ai-tutor")({
  validateSearch: parseTutorSearch,
  head: () => ({
    meta: [
      { title: "AI Tutor — Memskool" },
      {
        name: "description",
        content:
          "Study with the Crane5 tutor inside Memskool, using your authorized class and lesson context.",
      },
    ],
  }),
  component: AiTutorPage,
});

function AiTutorPage() {
  const examActive = useExamMode();
  const search = Route.useSearch();
  const { data: capabilities } = usePlatformCapabilities();
  const intent = (AI_INTENTS as readonly string[]).includes(search.intent ?? "")
    ? (search.intent as AiIntent)
    : search.assignment
      ? "ASSIGNMENT_HELP"
      : search.missed
        ? "MISSED_WORK_HELP"
        : search.lesson
          ? "EXPLAIN"
          : "CHAT";

  const launch: TutorLaunch = {
    lessonId: search.lesson ?? null,
    assignmentId: search.assignment ?? null,
    missedWorkId: search.missed ?? null,
    subjectId: search.subject ?? null,
    intent,
  };

  if (examActive) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-semibold">AI Tutor is locked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You have an examination in progress. The tutor stays disabled until you submit your paper.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">AI Tutor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crane5 teaches inside Memskool. Only your authorized lessons, assignments and memory are
          used.
        </p>
      </header>
      {capabilities && !capabilities.tutor ? (
        <ServiceNotice title="Tutor not connected yet">
          The AI Tutor waits for Crane5 credentials. Your classes, locker, assessments and live
          lessons still work. Ask AI buttons stay visible so the path is ready when Crane5 is
          connected.
        </ServiceNotice>
      ) : null}
      <AiTutorChat launch={launch} enabled={capabilities?.tutor === true} />
    </div>
  );
}
