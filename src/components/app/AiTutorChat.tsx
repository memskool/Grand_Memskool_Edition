import { useEffect, useRef, useState } from "react";
import { Bot, Copy, Mic, Plus, Send, Square, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ListSkeleton } from "@/components/app/primitives";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import type { AiIntent } from "@/types/ai";
import {
  useAiConversations,
  useAiMemory,
  useAiMessages,
  useDeleteConversation,
  useDeleteMemory,
  useSaveMemory,
  useSendTutorTurn,
} from "@/features/ai-tutor/ai-data";

const INTENTS: { value: AiIntent; label: string }[] = [
  { value: "CHAT", label: "Chat" },
  { value: "EXPLAIN", label: "Explain" },
  { value: "TEACH", label: "Teach" },
  { value: "SOLVE", label: "Work through" },
  { value: "REVISE", label: "Revise" },
  { value: "ASSIGNMENT_HELP", label: "Assignment" },
  { value: "MISSED_WORK_HELP", label: "Missed work" },
];

export type TutorLaunch = {
  lessonId: string | null;
  assignmentId: string | null;
  missedWorkId: string | null;
  subjectId: string | null;
  intent: AiIntent;
};

function speak(text: string) {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utter);
}

export function AiTutorChat({ launch }: { launch: TutorLaunch }) {
  const conversations = useAiConversations(true);
  const memory = useAiMemory(true);
  const send = useSendTutorTurn();
  const remove = useDeleteConversation();
  const saveMem = useSaveMemory();
  const delMem = useDeleteMemory();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messages = useAiMessages(conversationId);
  const [text, setText] = useState("");
  const [intent, setIntent] = useState<AiIntent>(launch.intent);
  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data, send.isPending]);

  const startVoice = () => {
    const Ctor =
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
        .webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input is not available in this browser.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-UG";
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const said = ev.results[0]?.[0]?.transcript ?? "";
      setText((t) => (t ? `${t} ${said}` : said));
      setIntent("VOICE_QUERY");
    };
    rec.onerror = () => toast.error("Could not hear that. Try again or type instead.");
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const submit = async () => {
    const message = text.trim();
    if (!message) return;
    setText("");
    try {
      const res = await send.mutateAsync({
        intent,
        message,
        conversation_id: conversationId,
        subject_id: launch.subjectId,
        lesson_id: launch.lessonId,
        assignment_id: launch.assignmentId,
        missed_work_id: launch.missedWorkId,
        topic_id: null,
        image_path: null,
      });
      setConversationId(res.conversation_id);
      setContextLabel(res.context_label);
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_14rem]">
      <aside className="rounded-3xl border border-white/15 bg-card/60 p-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium">Conversations</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-2"
            onClick={() => {
              setConversationId(null);
              setContextLabel(null);
            }}
          >
            <Plus className="size-4" /> New
          </Button>
        </div>
        {conversations.isLoading ? (
          <ListSkeleton rows={4} />
        ) : conversations.data?.length ? (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {conversations.data.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setConversationId(c.id)}
                  className={`min-w-0 flex-1 truncate rounded-xl px-2 py-2 text-left text-xs ${
                    conversationId === c.id ? "bg-primary/10 text-primary" : "hover:bg-secondary/60"
                  }`}
                >
                  {c.title}
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label="Delete conversation"
                  onClick={() =>
                    remove.mutate(c.id, {
                      onSuccess: () => {
                        if (conversationId === c.id) setConversationId(null);
                      },
                      onError: (e) => toast.error(authErrorMessage(e)),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No chats yet.</p>
        )}
      </aside>

      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-white/15 bg-card/60 backdrop-blur-xl">
        <header className="border-b border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-primary/12 text-primary hover:bg-primary/12">
              <Bot className="mr-1 size-3" /> Crane5 via Memskool
            </Badge>
            {contextLabel ? (
              <p className="text-xs text-muted-foreground">{contextLabel}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ask about a lesson, assignment, or topic.
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INTENTS.map((i) => (
              <button
                key={i.value}
                type="button"
                aria-pressed={intent === i.value}
                onClick={() => setIntent(i.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  intent === i.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground"
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.isLoading && conversationId ? <ListSkeleton rows={3} /> : null}
          {!conversationId && !send.isPending ? (
            <EmptyState
              icon={Bot}
              title="Start a conversation"
              hint="Choose a mode, then ask a question in your own words."
            />
          ) : null}
          {(messages.data ?? []).map((m) => (
            <article
              key={m.id}
              className={`max-w-[min(42rem,100%)] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "ml-auto bg-primary/10" : "bg-secondary/60"
              }`}
            >
              <p>{m.content}</p>
              {m.role === "assistant" ? (
                <div className="mt-2 flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Copy reply"
                    onClick={() => void navigator.clipboard.writeText(m.content)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Read aloud"
                    onClick={() => speak(m.content)}
                  >
                    <Volume2 className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Stop audio"
                    onClick={() => window.speechSynthesis.cancel()}
                  >
                    <Square className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
          {send.isPending ? (
            <p className="text-sm text-muted-foreground" role="status">
              The tutor is thinking…
            </p>
          ) : null}
          <div ref={bottom} />
        </div>
        <form
          className="border-t border-white/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="ai-input" className="sr-only">
            Message the tutor
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              id="ai-input"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask in your own words…"
              className="min-h-[72px] flex-1 resize-y"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={startVoice}
                aria-pressed={listening}
              >
                <Mic className="size-4" /> {listening ? "Listening" : "Voice"}
              </Button>
              <Button
                type="submit"
                className="rounded-full"
                disabled={send.isPending || !text.trim()}
              >
                <Send className="size-4" /> Send
              </Button>
            </div>
          </div>
        </form>
      </section>

      <aside className="rounded-3xl border border-white/15 bg-card/60 p-3 backdrop-blur-xl">
        <p className="mb-2 text-xs font-medium">Learning memory</p>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Short notes the tutor may use. Separate from chat history.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mb-3 w-full rounded-full"
          disabled={!conversationId}
          onClick={() => {
            const last = [...(messages.data ?? [])].reverse().find((m) => m.role === "assistant");
            if (!last) return;
            saveMem.mutate(
              { kind: "summary", topic: null, body: last.content.slice(0, 400) },
              {
                onSuccess: () => toast.success("Saved to learning memory"),
                onError: (e) => toast.error(authErrorMessage(e)),
              },
            );
          }}
        >
          Save last reply
        </Button>
        {memory.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto">
            {(memory.data ?? []).map((m) => (
              <li key={m.id} className="rounded-xl bg-secondary/50 px-3 py-2 text-xs">
                <p className="font-medium capitalize">{m.kind}</p>
                <p className="mt-1 text-muted-foreground">{m.body}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-7 px-2"
                  onClick={() =>
                    delMem.mutate(m.id, { onError: (e) => toast.error(authErrorMessage(e)) })
                  }
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

type SpeechRecognition = {
  lang: string;
  start: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
