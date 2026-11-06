import { useEffect, useMemo, useRef, useState } from "react";
import {
  Hand,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MessageSquare,
  PhoneOff,
  PictureInPicture2,
  Shuffle,
  BellRing,
  VolumeX,
  Users,
  SendHorizonal,
  Loader2,
  X,
  MonitorUp,
  FileText,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLiveKit, type RemoteMedia } from "@/hooks/useLiveKit";
import {
  useBulkParticipantUpdate,
  useClassroomChat,
  useCorrectLiveAttendance,
  useEndSession,
  useJoinRoom,
  useLeaveRoom,
  useParticipants,
  useReportPresence,
  useSendClassroomMessage,
  useSessionAttendance,
  useUpdateParticipant,
  type ClassroomSession,
  type Participant,
} from "@/lib/classroom-data";
import { useLessonMaterials } from "@/features/academic/academic-data";
import { useAssignMissedWork } from "@/features/academic/academic-data";
import { AskAiButton } from "@/components/app/AskAiButton";
import { getSchoolObjectUrl } from "@/lib/storage";
import { ATTENDANCE_STATUSES, type LessonMaterial } from "@/types/academic";
import { authErrorMessage } from "@/lib/errors/auth-errors";

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function elapsedLabel(startedAt: string) {
  const ms = Date.now() - Date.parse(startedAt);
  if (Number.isNaN(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  session: ClassroomSession;
  className: string;
  userId: string;
  isTeacher: boolean;
  onExit: () => void;
};

export function ClassroomRoom({ session, className, userId, isTeacher, onExit }: Props) {
  const isSessionHost = session.host_id === userId;
  // Staff chrome (mute-all, end, etc.) vs session host (stage ownership).
  const canModerate = isTeacher || isSessionHost;
  const media = useLiveKit(session.id);
  // Presence/chat must load even if join is slow — otherwise host UI says "Waiting for the teacher".
  const participants = useParticipants(session.id);
  const chat = useClassroomChat(session.id);
  const join = useJoinRoom();
  const leave = useLeaveRoom();
  const update = useUpdateParticipant();
  const bulk = useBulkParticipantUpdate();
  const endSession = useEndSession();
  const send = useSendClassroomMessage();
  const presence = useReportPresence();
  const materials = useLessonMaterials(session.lesson_id ?? undefined);

  const [chatOpen, setChatOpen] = useState(false);
  const [sideTab, setSideTab] = useState<"chat" | "materials">("chat");
  const [draft, setDraft] = useState("");
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [tick, setTick] = useState(0);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const joinedRef = useRef(false);
  const presenceRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  void tick;

  useEffect(() => {
    joinedRef.current = false;
    presenceRef.current = false;
    setJoinAttempt(0);
  }, [session.id, userId]);

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    join.mutate(
      { sessionId: session.id, userId, isHost: isSessionHost },
      {
        onSuccess: () => {
          void participants.refetch();
        },
        onError: (e) => {
          joinedRef.current = false;
          toast.error(authErrorMessage(e));
          // One automatic retry for transient permission/network failures.
          if (joinAttempt < 1) {
            window.setTimeout(() => setJoinAttempt((n) => n + 1), 1200);
          }
        },
      },
    );
    // join/participants identities are stable hooks; retry via joinAttempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, userId, isSessionHost, joinAttempt]);

  useEffect(() => {
    if (!media.connected || presenceRef.current) return;
    presenceRef.current = true;
    presence.mutate({ sessionId: session.id, userId });
  }, [media.connected, presence, session.id, userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.data?.length, chatOpen]);

  const live = useMemo(
    () => (participants.data ?? []).filter((p) => !p.left_at),
    [participants.data],
  );
  const me = live.find((p) => p.user_id === userId);
  const host = live.find((p) => p.is_host || p.user_id === session.host_id) ?? null;
  const learners = live.filter((p) => !p.is_host && p.user_id !== session.host_id);
  // Count the host even before their participant row finishes loading.
  const peopleCount = Math.max(
    live.length,
    isSessionHost && !live.some((p) => p.user_id === userId) ? live.length + 1 : live.length,
  );
  const screenRemote = Object.values(media.remotes).find((r) => r.screenTrack) ?? null;
  const stageRemote =
    screenRemote ??
    (host && host.user_id !== userId ? (media.remotes[host.user_id] ?? null) : null);

  const stageEmptyCopy = (() => {
    if (isSessionHost || (isTeacher && me?.is_host)) {
      return media.starting
        ? "Connecting your classroom…"
        : media.connected
          ? "You are live — turn on your camera or share your screen"
          : "You are hosting this class";
    }
    if (host) {
      return `${host.profile?.full_name ?? "Teacher"} is broadcasting`;
    }
    return "Waiting for the teacher…";
  })();

  useEffect(() => {
    if (!me) return;
    if (!me.mic_on && media.micOn) media.forceMute();
    if (!me.camera_allowed && media.camOn) media.forceCameraOff();
    // Teacher-enforced device state — do not depend on the whole media object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.mic_on, me?.camera_allowed]);

  useEffect(() => {
    if (me?.warned_at) {
      toast.warning("Your teacher nudged you — please stay engaged.");
    }
  }, [me?.warned_at]);

  const patch = (p: Parameters<typeof update.mutate>[0]["patch"], targetId = userId) =>
    update.mutate(
      { sessionId: session.id, userId: targetId, patch: p },
      { onError: (e) => toast.error(authErrorMessage(e)) },
    );

  const handleMic = async () => {
    const on = await media.toggleMic();
    patch({ mic_on: on });
  };

  const handleCam = async () => {
    if (me && !me.camera_allowed) {
      toast.error("Your teacher has turned your camera off for this session.");
      return;
    }
    const on = await media.toggleCam();
    patch({ cam_on: on });
  };

  const handleLeave = () => {
    media.stop();
    // Host Leave must end the room — otherwise students keep seeing a false LIVE badge.
    if (isSessionHost) {
      endSession.mutate(session, {
        onSuccess: () => {
          toast.success("Live session ended.");
          onExit();
        },
        onError: (e) => {
          toast.error(authErrorMessage(e));
          leave.mutate({ sessionId: session.id, userId }, { onSettled: onExit });
        },
      });
      return;
    }
    leave.mutate({ sessionId: session.id, userId }, { onSettled: onExit });
  };

  const handleEnd = () => {
    media.stop();
    endSession.mutate(session, {
      onSuccess: () => {
        toast.success("Session ended. Review attendance below.");
        setReview(true);
      },
      onError: (e) => toast.error(authErrorMessage(e)),
    });
  };

  const randomStudent = () => {
    if (!learners.length) {
      toast.info("No learners in the room yet.");
      return;
    }
    const pick = learners[Math.floor(Math.random() * learners.length)]!;
    setSpotlight(pick.user_id);
    toast.success(`${pick.profile?.full_name ?? "A learner"} was selected.`);
  };

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    send.mutate(
      { sessionId: session.id, senderId: userId, body },
      { onError: (err) => toast.error(authErrorMessage(err)) },
    );
  };

  if (review && canModerate) {
    return <AttendanceReview session={session} className={className} onDone={onExit} />;
  }

  const connectionCopy =
    media.status === "connecting"
      ? "Joining the classroom…"
      : media.status === "reconnecting"
        ? "Reconnecting…"
        : media.status === "disconnected" && !media.connecting
          ? "Connection lost. Check your network, then leave and join again if this continues."
          : null;

  const controlBtn =
    "rounded-full border border-ink/15 bg-ink text-ink-foreground shadow-sm hover:bg-ink/90 hover:text-ink-foreground";
  const controlBtnOn =
    "rounded-full border border-leaf/30 bg-leaf text-leaf-foreground shadow-sm hover:bg-leaf/90";
  const controlBtnSoft =
    "rounded-full border border-border bg-card text-card-foreground shadow-sm hover:bg-secondary";

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col gap-3 sm:gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Live class <span className="opacity-40">/</span> {className}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display truncate text-xl font-bold sm:text-2xl">{className}</h1>
            <Badge className="bg-destructive text-destructive-foreground">● Live</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {elapsedLabel(session.started_at)} · {peopleCount} in the room
            {isSessionHost ? " · You are hosting" : ""}
            {session.lesson_id ? " · Lesson linked" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className={cn(controlBtnSoft, "lg:hidden")}
            onClick={() => {
              setSideTab("chat");
              setChatOpen((v) => !v);
            }}
          >
            <MessageSquare className="size-4" /> Chat
          </Button>
          <Button
            size="sm"
            className={cn(controlBtnSoft, "lg:hidden")}
            onClick={() => {
              setSideTab("materials");
              setChatOpen((v) => !v);
            }}
          >
            <FileText className="size-4" /> Materials
          </Button>
        </div>
      </header>

      {connectionCopy ? (
        <Alert>
          <AlertTitle>
            {media.status === "reconnecting"
              ? "Reconnecting"
              : media.status === "connecting"
                ? "Connecting"
                : "Connection lost"}
          </AlertTitle>
          <AlertDescription>{connectionCopy}</AlertDescription>
        </Alert>
      ) : null}

      {media.error ? (
        <Alert variant="destructive">
          <AlertTitle>
            {media.error.kind === "config"
              ? "Live video is not configured"
              : media.error.kind === "permission"
                ? "Permission needed"
                : media.error.kind === "unsupported"
                  ? "Not supported here"
                  : "Unable to join the classroom"}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{media.error.message}</span>
            <Button size="sm" variant="ghost" onClick={media.clearError} aria-label="Dismiss error">
              <X className="size-4" />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_min(22rem,32%)] lg:gap-4">
        <section className="flex min-w-0 flex-col gap-3">
          <div
            className="relative min-h-[220px] w-full flex-1 overflow-hidden rounded-2xl border border-border bg-ink text-ink-foreground sm:min-h-[280px] lg:min-h-0 lg:max-h-[min(58vh,40rem)]"
            role="region"
            aria-label="Main classroom video"
          >
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-destructive-foreground">
                <span className="size-1.5 rounded-full bg-current" /> Live
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                <Users className="size-3.5" /> {peopleCount}
              </span>
            </div>

            {stageRemote?.screenTrack ? (
              <RemoteVideo
                track={stageRemote.screenTrack}
                className="size-full object-contain bg-black"
              />
            ) : stageRemote?.videoTrack ? (
              <RemoteVideo track={stageRemote.videoTrack} className="size-full object-cover" />
            ) : null}
            <video
              ref={media.screenVideoRef}
              muted
              playsInline
              autoPlay
              className={cn(
                "size-full object-contain bg-black",
                media.screenShareOn && !stageRemote?.screenTrack ? "block" : "hidden",
              )}
            />
            <video
              ref={media.videoRef}
              muted
              playsInline
              autoPlay
              className={cn(
                "size-full object-cover",
                media.camOn &&
                  !stageRemote?.videoTrack &&
                  !media.screenShareOn &&
                  !stageRemote?.screenTrack
                  ? "block"
                  : "hidden",
              )}
            />
            {!media.camOn &&
            !media.screenShareOn &&
            !stageRemote?.videoTrack &&
            !stageRemote?.screenTrack ? (
              <div className="flex size-full flex-col items-center justify-center gap-3">
                <span className="flex size-20 items-center justify-center rounded-full bg-white/10 font-display text-2xl">
                  {initials(host?.profile?.full_name ?? className)}
                </span>
                <p className="max-w-[22rem] px-4 text-center text-sm text-ink-muted">
                  {stageEmptyCopy}
                </p>
                {media.starting ? <Loader2 className="size-4 animate-spin opacity-70" /> : null}
              </div>
            ) : null}
            <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur">
              {stageRemote?.screenTrack
                ? "Shared screen"
                : media.screenShareOn
                  ? "You are sharing your screen"
                  : stageRemote?.videoTrack
                    ? (host?.profile?.full_name ?? "Teacher")
                    : media.camOn
                      ? "You (camera on)"
                      : "Stage"}
            </div>
          </div>

          {Object.values(media.remotes).map((r) => (
            <RemoteAudio key={r.identity} media={r} />
          ))}

          <div className="surface-card flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                size="icon"
                className={cn("size-11", media.micOn ? controlBtnOn : controlBtn)}
                onClick={handleMic}
                aria-label={media.micOn ? "Mute microphone" : "Unmute microphone"}
              >
                {media.micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </Button>
              <Button
                size="icon"
                className={cn("size-11", media.camOn ? controlBtnOn : controlBtn)}
                onClick={handleCam}
                aria-label={media.camOn ? "Stop video" : "Start video"}
              >
                {media.camOn ? <VideoIcon className="size-5" /> : <VideoOff className="size-5" />}
              </Button>
              {canModerate && media.canShareScreen ? (
                <Button
                  className={cn(media.screenShareOn ? controlBtnOn : controlBtn)}
                  onClick={() => void media.toggleScreenShare()}
                  aria-label={media.screenShareOn ? "Stop sharing screen" : "Share screen"}
                  disabled={!media.screenShareSupported}
                  title={
                    media.screenShareSupported
                      ? "Share your screen"
                      : "Screen sharing needs a desktop browser"
                  }
                >
                  <MonitorUp className="size-4" />
                  <span className="hidden sm:inline">
                    {media.screenShareOn ? "Stop share" : "Share screen"}
                  </span>
                </Button>
              ) : null}
              {!canModerate ? (
                <Button
                  className={cn(me?.hand_raised ? controlBtnOn : controlBtn)}
                  onClick={() => patch({ hand_raised: !me?.hand_raised })}
                >
                  <Hand className="size-4" /> {me?.hand_raised ? "Lower hand" : "Raise hand"}
                </Button>
              ) : null}
              <Button
                className={cn(media.pipActive ? controlBtnOn : controlBtnSoft)}
                onClick={media.togglePictureInPicture}
                title="Keep listening while you browse other tabs"
              >
                <PictureInPicture2 className="size-4" />
                <span className="hidden sm:inline">
                  {media.pipActive ? "Exit mini player" : "Mini player"}
                </span>
              </Button>
              <Button variant="destructive" className="rounded-full" onClick={handleLeave}>
                <PhoneOff className="size-4" /> Leave
              </Button>
              {canModerate ? (
                <Button
                  className={cn(
                    controlBtn,
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                  )}
                  onClick={handleEnd}
                  disabled={endSession.isPending}
                >
                  End session
                </Button>
              ) : null}
            </div>

            {canModerate ? (
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border pt-3">
                <span className="w-full text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:mr-1 sm:w-auto sm:text-left">
                  Teacher controls
                </span>
                <Button
                  size="sm"
                  className={controlBtn}
                  onClick={() =>
                    bulk.mutate(
                      { sessionId: session.id, patch: { mic_on: false }, exceptUserId: userId },
                      {
                        onSuccess: () => toast.success("All learners muted"),
                        onError: (e) => toast.error(authErrorMessage(e)),
                      },
                    )
                  }
                >
                  <VolumeX className="size-4" /> Mute all
                </Button>
                <Button size="sm" className={controlBtn} onClick={randomStudent}>
                  <Shuffle className="size-4" /> Random learner
                </Button>
                <Button
                  size="sm"
                  className={controlBtn}
                  onClick={() =>
                    bulk.mutate(
                      {
                        sessionId: session.id,
                        patch: { warned_at: new Date().toISOString() },
                        exceptUserId: userId,
                      },
                      {
                        onSuccess: () => toast.success("Wake-up nudge sent"),
                        onError: (e) => toast.error(authErrorMessage(e)),
                      },
                    )
                  }
                >
                  <BellRing className="size-4" /> Nudge inactive
                </Button>
              </div>
            ) : null}
          </div>

          <div className="surface-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Learners ({learners.length})</h2>
            {participants.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video rounded-xl" />
                ))}
              </div>
            ) : learners.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {learners.map((p) => (
                  <ParticipantTile
                    key={p.id}
                    participant={p}
                    remote={media.remotes[p.user_id] ?? null}
                    spotlighted={spotlight === p.user_id}
                    isTeacher={canModerate}
                    onToggleCamera={() =>
                      patch({ camera_allowed: !p.camera_allowed, cam_on: false }, p.user_id)
                    }
                    onMute={() => patch({ mic_on: false }, p.user_id)}
                    onWarn={() => {
                      patch({ warned_at: new Date().toISOString() }, p.user_id);
                      toast.success(`Nudge sent to ${p.profile?.full_name ?? "learner"}`);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {canModerate
                  ? "No learners have joined yet. Share the live class with your students."
                  : "No other learners are in the room yet."}
              </p>
            )}
          </div>
        </section>

        <aside className={cn("flex min-h-0 flex-col gap-3", chatOpen ? "flex" : "hidden lg:flex")}>
          <div className={cn(sideTab === "materials" || !chatOpen ? "block" : "hidden lg:block")}>
            <MaterialsPanel
              materials={materials.data ?? []}
              loading={materials.isLoading}
              lessonId={session.lesson_id ?? null}
            />
          </div>
          <div
            className={cn(
              "flex min-h-[18rem] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card",
              sideTab === "chat" || !chatOpen ? "flex" : "hidden lg:flex",
            )}
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Live chat</h2>
              <Button
                size="icon"
                variant="ghost"
                className="lg:hidden"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
              >
                <X className="size-4" />
              </Button>
            </header>
            <ScrollArea className="min-h-0 flex-1 px-4 py-3">
              {chat.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : chat.data?.length ? (
                <ul className="space-y-3">
                  {chat.data.map((m) => {
                    const mine = m.sender_id === userId;
                    return (
                      <li
                        key={m.id}
                        className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
                      >
                        <span className="text-[11px] text-muted-foreground">
                          {mine ? "You" : (m.sender?.full_name ?? "Someone")} · {time(m.created_at)}
                        </span>
                        <span
                          className={cn(
                            "max-w-[85%] break-words rounded-3xl px-3.5 py-2 text-sm",
                            mine
                              ? "rounded-br-md bg-ink text-ink-foreground"
                              : "rounded-bl-md bg-secondary text-secondary-foreground",
                          )}
                        >
                          {m.body}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">No messages yet.</p>
              )}
              <div ref={chatEndRef} />
            </ScrollArea>
            <form onSubmit={submitChat} className="flex gap-2 border-t border-border p-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message this class"
                className="rounded-full"
                aria-label="Classroom chat message"
                maxLength={4000}
              />
              <Button
                type="submit"
                size="icon"
                className={cn("size-10 shrink-0", controlBtn)}
                disabled={!draft.trim() || send.isPending}
                aria-label="Send message"
              >
                <SendHorizonal className="size-4" />
              </Button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MaterialsPanel({
  materials,
  loading,
  lessonId,
}: {
  materials: LessonMaterial[];
  loading: boolean;
  lessonId: string | null;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Lesson materials
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-base font-bold">This lesson</p>
        {lessonId ? <AskAiButton lessonId={lessonId} label="Ask AI" /> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-10 w-full" />
      ) : materials.length ? (
        <ul className="mt-3 space-y-2">
          {materials.map((m) => (
            <li key={m.id}>
              <MaterialLink material={m} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {lessonId
            ? "No files are attached to this lesson yet."
            : "Start the session from a lesson to show its materials here."}
        </p>
      )}
    </div>
  );
}

function MaterialLink({ material }: { material: LessonMaterial }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (material.url) {
      window.open(material.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!material.storage_path) return;
    setBusy(true);
    try {
      const href = await getSchoolObjectUrl(material.storage_path);
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy || (!material.url && !material.storage_path)}
      className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-sm text-foreground hover:bg-secondary disabled:opacity-60"
    >
      {material.kind === "link" ? (
        <ExternalLink className="size-3.5" />
      ) : (
        <FileText className="size-3.5" />
      )}
      <span className="truncate">{material.title}</span>
    </button>
  );
}

function AttendanceReview({
  session,
  className,
  onDone,
}: {
  session: ClassroomSession;
  className: string;
  onDone: () => void;
}) {
  const rows = useSessionAttendance(session.id);
  const correct = useCorrectLiveAttendance();
  const missed = useAssignMissedWork();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Attendance
        </p>
        <h1 className="font-display text-2xl font-bold">{className}</h1>
        <p className="text-sm text-muted-foreground">
          Provisional marks come from verified LiveKit joins, not from tapping Join. Correct them if
          needed. Missed-work items are assigned by you — they are not invented automatically.
        </p>
      </div>
      {rows.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {(rows.data ?? []).map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{row.profile?.full_name ?? "Student"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.status}
                  {row.provisional ? " · provisional" : " · confirmed"}
                  {typeof row.duration_ms === "number"
                    ? ` · ${Math.round(row.duration_ms / 60000)} min connected`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ATTENDANCE_STATUSES.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={row.status === status ? "default" : "outline"}
                    className="rounded-full capitalize"
                    disabled={correct.isPending}
                    onClick={() =>
                      correct.mutate(
                        { sessionId: session.id, studentId: row.student_id, status },
                        { onError: (e) => toast.error(authErrorMessage(e)) },
                      )
                    }
                  >
                    {status}
                  </Button>
                ))}
                {row.status === "absent" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    disabled={missed.isPending}
                    onClick={() =>
                      missed.mutate(
                        {
                          student_id: row.student_id,
                          lesson_id: session.lesson_id ?? null,
                          class_id: session.class_id,
                          subject_id: null,
                          assignment_id: null,
                          material_id: null,
                          title: `Catch up: ${session.title ?? className}`,
                        },
                        {
                          onSuccess: () => toast.success("Missed work assigned"),
                          onError: (e) => toast.error(authErrorMessage(e)),
                        },
                      )
                    }
                  >
                    Assign catch-up
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button className="rounded-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function ParticipantTile({
  participant: p,
  remote,
  spotlighted,
  isTeacher,
  onToggleCamera,
  onMute,
  onWarn,
}: {
  participant: Participant;
  remote: RemoteMedia | null;
  spotlighted: boolean;
  isTeacher: boolean;
  onToggleCamera: () => void;
  onMute: () => void;
  onWarn: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl bg-secondary/60 p-2 text-center",
        spotlighted && "ring-2 ring-primary",
        remote?.speaking && "ring-2 ring-primary/60",
      )}
    >
      {remote?.videoTrack ? (
        <RemoteVideo
          track={remote.videoTrack}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {initials(p.profile?.full_name)}
          </span>
          <p className="mt-2 line-clamp-1 text-xs font-medium">
            {p.profile?.full_name ?? "Learner"}
          </p>
        </>
      )}

      <div className="absolute left-2 top-2 flex gap-1">
        {p.hand_raised ? <Hand className="size-4 text-warning-foreground" /> : null}
        {!p.mic_on ? <MicOff className="size-3.5 text-muted-foreground" /> : null}
        {!p.camera_allowed ? <VideoOff className="size-3.5 text-destructive" /> : null}
      </div>
      {isTeacher ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
          <Button
            size="icon"
            variant="secondary"
            className="size-7 rounded-full"
            onClick={onMute}
            title="Mute"
            aria-label={`Mute ${p.profile?.full_name ?? "learner"}`}
          >
            <MicOff className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-7 rounded-full"
            onClick={onToggleCamera}
            title={p.camera_allowed ? "Turn camera off" : "Allow camera"}
            aria-label="Toggle camera permission"
          >
            {p.camera_allowed ? (
              <VideoOff className="size-3.5" />
            ) : (
              <VideoIcon className="size-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-7 rounded-full"
            onClick={onWarn}
            title="Nudge"
            aria-label="Nudge learner"
          >
            <BellRing className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RemoteVideo({
  track,
  className,
}: {
  track: NonNullable<RemoteMedia["videoTrack"]>;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} autoPlay playsInline muted className={className} />;
}

function RemoteAudio({ media }: { media: RemoteMedia }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    const track = media.audioTrack;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [media.audioTrack]);
  return <audio ref={ref} autoPlay className="hidden" />;
}
