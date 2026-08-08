import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles,
  Copy,
  ExternalLink,
  Maximize2,
  RefreshCw,
  ShieldAlert,
  Wand2,
  Brain,
  ListChecks,
  Target,
  BookOpenCheck,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExamMode } from "@/lib/exam-mode";

const CRANE5_URL = "https://crane5.com";

const QUICK_PROMPTS = [
  {
    icon: Brain,
    label: "Explain like I'm 10",
    text: "Explain this topic to me like I'm 10 years old, using a simple everyday example: ",
  },
  {
    icon: ListChecks,
    label: "Analyze my mistakes",
    text: "Here is my work. Point out every mistake, explain why it's wrong, and show the correct step-by-step solution: ",
  },
  {
    icon: Wand2,
    label: "Generate a quiz",
    text: "Generate a 10-question quiz (mix of multiple choice and short answer) with an answer key on this topic: ",
  },
  {
    icon: Target,
    label: "Exam strategy tip",
    text: "Give me a practical exam strategy for answering questions on this topic under time pressure: ",
  },
  {
    icon: BookOpenCheck,
    label: "Summarise my notes",
    text: "Summarise these notes into concise revision flashcards with key definitions: ",
  },
  {
    icon: Lightbulb,
    label: "Real-world example",
    text: "Give me three real-world examples that show how this concept is actually used: ",
  },
] as const;

export const Route = createFileRoute("/_authenticated/ai-tutor")({
  head: () => ({
    meta: [
      { title: "AI Tutor — Memskool" },
      {
        name: "description",
        content:
          "Study with the Crane5 AI teacher inside Memskool — quick prompts, instant explanations and practice questions.",
      },
      { property: "og:title", content: "AI Tutor — Memskool" },
      {
        property: "og:description",
        content: "Crane5 AI tutoring built right into your Memskool workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiTutorPage,
});

function AiTutorPage() {
  const examActive = useExamMode();
  const [frameKey, setFrameKey] = useState(0);

  const copyPrompt = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`"${label}" copied`, { description: "Paste it into the Crane5 chat." });
    } catch {
      toast.error("Clipboard blocked by your browser");
    }
  };

  if (examActive) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-semibold">AI Tutor is locked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You have an examination in progress. Crane5 and all AI tools stay disabled until you
          submit your paper.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[110px]"
      />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge className="mb-2 rounded-full bg-primary/12 text-primary hover:bg-primary/12">
            <Sparkles className="mr-1 size-3" /> Powered by Crane5
          </Badge>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">AI Tutor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your always-on teacher. Ask anything, share your handwritten work, get it explained.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setFrameKey((k) => k + 1)}
          >
            <RefreshCw className="size-4" /> Reload
          </Button>
          <Button
            className="rounded-full"
            onClick={() => window.open(CRANE5_URL, "_blank", "noopener,noreferrer")}
          >
            <Maximize2 className="size-4" /> Pop out
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* Webview */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-card/60 shadow-[0_24px_70px_-30px_color-mix(in_oklab,var(--primary)_55%,transparent)] backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/80" />
            <span className="size-2.5 rounded-full bg-success/80" />
            <span className="ml-3 flex-1 truncate rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              crane5.com
            </span>
            <a
              href={CRANE5_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Open Crane5 in a new tab"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
          <iframe
            key={frameKey}
            src={CRANE5_URL}
            title="Crane5 AI Tutor"
            className="h-[70vh] min-h-[520px] w-full bg-background"
            allow="clipboard-write; microphone; camera; fullscreen"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Toolkit */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/15 bg-card/60 p-4 backdrop-blur-xl">
            <h2 className="mb-1 font-display text-sm font-semibold">AI Toolkit</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Tap a prompt to copy it, then paste into the chat.
            </p>
            <div className="space-y-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => copyPrompt(p.text, p.label)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/50 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <p.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.label}</span>
                  <Copy className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Study smart</p>
            Snap a photo of your handwritten work and upload it in the Crane5 chat — it can read
            your steps and point out exactly where things went wrong.
          </div>
        </aside>
      </div>
    </div>
  );
}
