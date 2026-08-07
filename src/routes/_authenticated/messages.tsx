import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Plus, Ban, BellOff, Search, Users, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import {
  useCreateConversation,
  useDirectory,
  useMessages,
  useMyConversations,
  useSendMessage,
  useSetRelation,
  useUserRelations,
  type Conversation,
  type ConversationKind,
} from "@/lib/messaging-data";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { SuspensionNotice } from "@/components/app/SuspensionNotice";
import { useSuspensionStatus } from "@/lib/discipline-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Memskool" },
      {
        name: "description",
        content:
          "Direct messages, class group chats and teacher consultation clinics with instant realtime delivery.",
      },
      { property: "og:title", content: "Messages — Memskool" },
      { property: "og:description", content: "Chat with classmates and teachers in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function conversationLabel(c: Conversation, userId: string) {
  if (c.title) return c.title;
  const other = c.members.find((m) => m.user_id !== userId);
  return other?.profile?.full_name ?? "Conversation";
}

function MessagesPage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);
  const userId = user?.id;
  const conversations = useMyConversations(userId);
  const relations = useUserRelations(userId);
  const setRelation = useSetRelation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ConversationKind>("all");

  const blocked = useMemo(
    () => new Set((relations.data ?? []).filter((r) => r.relation === "block").map((r) => r.target_id)),
    [relations.data],
  );
  const muted = useMemo(
    () => new Set((relations.data ?? []).filter((r) => r.relation === "mute").map((r) => r.target_id)),
    [relations.data],
  );

  const list = (conversations.data ?? []).filter((c) => filter === "all" || c.kind === filter);
  const active = list.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Direct chats, class groups and teacher consultation clinics."
        action={
          userId ? (
            <NewConversationDialog userId={userId} isStaff={role === "teacher" || role === "admin"} />
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Panel title="Conversations" className="p-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="mb-3 w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="direct" className="flex-1">Direct</TabsTrigger>
              <TabsTrigger value="group" className="flex-1">Groups</TabsTrigger>
              <TabsTrigger value="clinic" className="flex-1">Clinics</TabsTrigger>
            </TabsList>
          </Tabs>
          {conversations.isLoading ? (
            <ListSkeleton />
          ) : list.length ? (
            <ul className="space-y-1">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/60",
                      activeId === c.id && "bg-secondary",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {c.kind === "clinic" ? (
                        <Stethoscope className="size-4" />
                      ) : c.kind === "group" ? (
                        <Users className="size-4" />
                      ) : (
                        <MessageSquare className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {conversationLabel(c, userId ?? "")}
                      </span>
                      <span className="block text-xs capitalize text-muted-foreground">{c.kind}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              hint="Start a chat with a classmate or teacher."
            />
          )}
        </Panel>

        {active && userId ? (
          <ChatPane
            conversation={active}
            userId={userId}
            blocked={blocked}
            muted={muted}
            onRelation={(targetId, relation, enabled) =>
              setRelation.mutate(
                { userId, targetId, relation, enabled },
                {
                  onSuccess: () => toast.success(enabled ? `User ${relation}ed` : `User un${relation}ed`),
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          />
        ) : (
          <Panel title="Select a conversation" description="Messages appear instantly, no refresh needed">
            <EmptyState icon={MessageSquare} title="Nothing open" hint="Pick a conversation on the left." />
          </Panel>
        )}
      </div>
    </>
  );
}

function ChatPane({
  conversation,
  userId,
  blocked,
  muted,
  onRelation,
}: {
  conversation: Conversation;
  userId: string;
  blocked: Set<string>;
  muted: Set<string>;
  onRelation: (targetId: string, relation: "mute" | "block", enabled: boolean) => void;
}) {
  const messages = useMessages(conversation.id);
  const send = useSendMessage();
  const [draft, setDraft] = useState("");

  const visible = (messages.data ?? []).filter((m) => !blocked.has(m.sender_id));
  const others = conversation.members.filter((m) => m.user_id !== userId);

  return (
    <section className="surface-card flex min-h-[28rem] flex-col p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="font-display text-base font-semibold">{conversationLabel(conversation, userId)}</h2>
          <p className="text-xs capitalize text-muted-foreground">
            {conversation.kind} · {conversation.members.length} members
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {others.map((m) => (
            <div key={m.user_id} className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-1">
              <span className="max-w-24 truncate text-xs">{m.profile?.full_name ?? "Member"}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                title={muted.has(m.user_id) ? "Unmute" : "Mute"}
                onClick={() => onRelation(m.user_id, "mute", !muted.has(m.user_id))}
              >
                <BellOff className={cn("size-3.5", muted.has(m.user_id) && "text-warning-foreground")} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                title={blocked.has(m.user_id) ? "Unblock" : "Block"}
                onClick={() => onRelation(m.user_id, "block", !blocked.has(m.user_id))}
              >
                <Ban className={cn("size-3.5", blocked.has(m.user_id) && "text-destructive")} />
              </Button>
            </div>
          ))}
        </div>
      </header>

      <ScrollArea className="flex-1 px-5 py-4">
        {messages.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-2/3 rounded-xl" />
            ))}
          </div>
        ) : visible.length ? (
          <ul className="space-y-3">
            {visible.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2",
                      mine ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {!mine ? (
                      <p className="text-xs opacity-70">
                        {m.sender?.full_name ?? "Someone"}
                        {muted.has(m.sender_id) ? " · muted" : ""}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                    <p className="mt-0.5 text-[10px] opacity-70">{time(m.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={MessageSquare} title="No messages yet" hint="Say hello to get the conversation going." />
        )}
      </ScrollArea>

      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body) return;
          setDraft("");
          send.mutate(
            { conversationId: conversation.id, senderId: userId, body },
            { onError: (err) => toast.error((err as Error).message) },
          );
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message"
          className="rounded-full"
        />
        <Button type="submit" className="rounded-full" disabled={!draft.trim() || send.isPending}>
          Send
        </Button>
      </form>
    </section>
  );
}

function NewConversationDialog({ userId, isStaff }: { userId: string; isStaff: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ConversationKind>("direct");
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const directory = useDirectory(userId, search);
  const create = useCreateConversation();

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : kind === "direct" ? [id] : [...prev, id],
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="size-4" /> New chat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
        </DialogHeader>
        <Tabs value={kind} onValueChange={(v) => setKind(v as ConversationKind)}>
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">Direct</TabsTrigger>
            <TabsTrigger value="group" className="flex-1">Group</TabsTrigger>
            <TabsTrigger value="clinic" className="flex-1" disabled={!isStaff}>
              Clinic
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {kind !== "direct" ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "clinic" ? "Clinic name, e.g. Physics consultations" : "Group name"}
          />
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-56 rounded-xl border border-border">
          {directory.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : directory.data?.length ? (
            <ul className="p-2">
              {directory.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary/60",
                      selected.includes(p.id) && "bg-secondary",
                    )}
                  >
                    <span className="truncate">{p.full_name || "Unnamed"}</span>
                    {selected.includes(p.id) ? <Badge variant="secondary">Selected</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">No people found.</p>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button
            className="rounded-full"
            disabled={!selected.length || create.isPending || (kind !== "direct" && !title.trim())}
            onClick={() =>
              create.mutate(
                { creatorId: userId, kind, title: kind === "direct" ? null : title.trim(), memberIds: selected },
                {
                  onSuccess: () => {
                    toast.success("Conversation created");
                    setOpen(false);
                    setSelected([]);
                    setTitle("");
                  },
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
