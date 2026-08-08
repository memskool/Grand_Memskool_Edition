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
  Loader2,
  X,
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
  useEndSession,
  useJoinRoom,
  useLeaveRoom,
  useParticipants,
  useSendClassroomMessage,
  useUpdateParticipant,
  type ClassroomSession,
  type Participant,
} from "@/lib/classroom-data";

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

type Props = {
  session: ClassroomSession;
  className: string;
  userId: string;
  isTeacher: boolean;
  onExit: () => void;
};

export function ClassroomRoom({ session, className, userId, isTeacher, onExit }: Props) {
  const media = useLiveKit(session.id);
  const participants = useParticipants(session.id);
  const chat = useClassroomChat(session.id);
  const join = useJoinRoom();
  const leave = useLeaveRoom();
  const update = useUpdateParticipant();
  const bulk = useBulkParticipantUpdate();
  const endSession = useEndSession();
  const send = useSendClassroomMessage();

  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const joinedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    join.mutate(
      { sessionId: session.id, userId, isHost: isTeacher },
      { onError: (e) => toast.error((e as Error).message) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, userId, isTeacher]);

  // The LiveKit hook attaches the published camera track to this element.

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.data?.length, chatOpen]);

  const live = useMemo(
    () => (participants.data ?? []).filter((p) => !p.left_at),
    [participants.data],
  );
  const me = live.find((p) => p.user_id === userId);
  const host = live.find((p) => p.is_host) ?? null;
  const learners = live.filter((p) => !p.is_host);
  const stageRemote =
    host && host.user_id !== userId ? (media.remotes[host.user_id] ?? null) : null;

  // Teacher-enforced state pushed down to the local devices.
  useEffect(() => {
    if (!me) return;
    if (!me.mic_on && media.micOn) media.forceMute();
    if (!me.camera_allowed && media.camOn) media.forceCameraOff();
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
      { onError: (e) => toast.error((e as Error).message) },
    );

  const handleMic = async () => {
    if (me && !me.mic_on && !isTeacher && me.camera_allowed === false) {
      // camera lock does not affect mic; no-op guard kept simple
    }
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
    leave.mutate({ sessionId: session.id, userId }, { onSettled: onExit });
  };

  const handleEnd = () => {
    media.stop();
    endSession.mutate(session, {
      onSuccess: () => {
        toast.success("Session ended");
        onExit();
      },
      onError: (e) => toast.error((e as Error).message),
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
      { onError: (err) => toast.error((err as Error).message) },
    );
  };

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-8rem)] lg:flex-row">
      {/* Stage + grid */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-xl font-semibold sm:text-2xl">{className}</h1>
            <p className="text-xs text-muted-foreground">
              Live since {time(session.started_at)} · {live.length} in the room
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-destructive/10 text-destructive">● Live</Badge>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full lg:hidden"
              onClick={() => setChatOpen((v) => !v)}
            >
              <MessageSquare className="size-4" /> Chat
            </Button>
          </div>
        </div>

        {media.error ? (
          <Alert variant="destructive">
            <AlertTitle>Device access issue</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{media.error.message}</span>
              <Button size="sm" variant="ghost" onClick={media.clearError}>
                <X className="size-4" />
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Main stage — the teacher's published feed, or your own preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-foreground/90 text-background">
          {stageRemote?.videoTrack ? (
            <RemoteVideo media={stageRemote} className="size-full object-cover" />
          ) : null}
          <video
            ref={media.videoRef}
            muted
            playsInline
            autoPlay
            className={cn(
              "size-full object-cover",
              media.camOn && !stageRemote?.videoTrack ? "block" : "hidden",
            )}
          />
          {!media.camOn && !stageRemote?.videoTrack ? (
            <div className="flex size-full flex-col items-center justify-center gap-3">
              <span className="flex size-20 items-center justify-center rounded-full bg-background/15 font-display text-2xl">
                {initials(host?.profile?.full_name ?? className)}
              </span>
              <p className="text-sm opacity-80">
                {host
                  ? `${host.profile?.full_name ?? "Teacher"} is broadcasting`
                  : "Waiting for the teacher…"}
              </p>
              {media.starting ? <Loader2 className="size-4 animate-spin opacity-70" /> : null}
            </div>
          ) : null}
          <div className="absolute bottom-3 left-3 rounded-full bg-background/20 px-3 py-1 text-xs backdrop-blur">
            {stageRemote?.videoTrack
              ? (host?.profile?.full_name ?? "Teacher")
              : media.camOn
                ? "You (camera on)"
                : "Stage"}
          </div>
        </div>

        {/* Audio for everyone else in the room */}
        {Object.values(media.remotes).map((r) => (
          <RemoteAudio key={r.identity} media={r} />
        ))}

        {/* Controls */}
        <div className="surface-card flex flex-wrap items-center justify-center gap-2 p-3">
          <Button
            variant={media.micOn ? "default" : "outline"}
            size="icon"
            className="size-11 rounded-full"
            onClick={handleMic}
            aria-label={media.micOn ? "Mute microphone" : "Unmute microphone"}
          >
            {media.micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </Button>
          <Button
            variant={media.camOn ? "default" : "outline"}
            size="icon"
            className="size-11 rounded-full"
            onClick={handleCam}
            aria-label={media.camOn ? "Stop video" : "Start video"}
          >
            {media.camOn ? <VideoIcon className="size-5" /> : <VideoOff className="size-5" />}
          </Button>
          {!isTeacher ? (
            <Button
              variant={me?.hand_raised ? "default" : "outline"}
              className="rounded-full"
              onClick={() => patch({ hand_raised: !me?.hand_raised })}
            >
              <Hand className="size-4" /> {me?.hand_raised ? "Lower hand" : "Raise hand"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="rounded-full"
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
          {isTeacher ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={handleEnd}
              disabled={endSession.isPending}
            >
              End session
            </Button>
          ) : null}
        </div>

        {/* Teacher control panel */}
        {isTeacher ? (
          <div className="surface-card flex flex-wrap items-center gap-2 p-3">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Teacher controls
            </span>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                bulk.mutate(
                  { sessionId: session.id, patch: { mic_on: false }, exceptUserId: userId },
                  {
                    onSuccess: () => toast.success("All learners muted"),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
            >
              <VolumeX className="size-4" /> Mute all
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={randomStudent}>
              <Shuffle className="size-4" /> Random learner
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                bulk.mutate(
                  {
                    sessionId: session.id,
                    patch: { warned_at: new Date().toISOString() },
                    exceptUserId: userId,
                  },
                  {
                    onSuccess: () => toast.success("Wake-up nudge sent"),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
            >
              <BellRing className="size-4" /> Nudge inactive
            </Button>
          </div>
        ) : null}

        {/* Participant grid */}
        <div className="surface-card p-4">
          <h2 className="mb-3 text-sm font-medium">Learners ({learners.length})</h2>
          {participants.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-xl" />
              ))}
            </div>
          ) : learners.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {learners.map((p) => (
                <ParticipantTile
                  key={p.id}
                  participant={p}
                  remote={media.remotes[p.user_id] ?? null}
                  spotlighted={spotlight === p.user_id}
                  isTeacher={isTeacher}

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
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No learners have joined yet.
            </p>
          )}
        </div>
      </div>

      {/* Chat sidebar */}
      <aside
        className={cn(
          "surface-card flex w-full shrink-0 flex-col p-0 lg:w-80",
          chatOpen ? "flex" : "hidden lg:flex",
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Live chat</h2>
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setChatOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </header>
        <ScrollArea className="h-64 flex-1 px-4 py-3 lg:h-auto">
          {chat.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : chat.data?.length ? (
            <ul className="space-y-3">
              {chat.data.map((m) => (
                <li key={m.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">
                    {m.sender?.full_name ?? "Someone"} · {time(m.created_at)}
                  </p>
                  <p className="break-words">{m.body}</p>
                </li>
              ))}
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
            placeholder="Message the class"
            className="rounded-full"
          />
          <Button type="submit" size="sm" className="rounded-full" disabled={!draft.trim()}>
            Send
          </Button>
        </form>
      </aside>
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
        <RemoteVideo media={remote} className="absolute inset-0 size-full object-cover" />
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
          >
            <MicOff className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-7 rounded-full"
            onClick={onToggleCamera}
            title={p.camera_allowed ? "Turn camera off" : "Allow camera"}
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
          >
            <BellRing className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RemoteVideo({ media, className }: { media: RemoteMedia; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    const track = media.videoTrack;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [media.videoTrack]);
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
