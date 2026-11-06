import { useEffect, useMemo, useRef, useState } from "react";
import type { RemoteTrack } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  MessageSquare,
  SendHorizonal,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useLiveKit } from "@/hooks/useLiveKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useClassroomChat,
  useEndSession,
  useJoinRoom,
  useLeaveRoom,
  useReportPresence,
  useSendClassroomMessage,
  type ClassroomSession,
} from "@/lib/classroom-data";
import { getById, COLLECTIONS } from "@/lib/firebase/repo";
import { useSession } from "@/hooks/useAuth";
import { authErrorMessage } from "@/lib/errors/auth-errors";

/**
 * Phase 8: Gold live reuses ClassroomRoom primitives (LiveKit, chat, leave/end)
 * without school-only panels (attendance/missed work).
 */
export function GoldLiveRoom({ sessionId, onLeave }: { sessionId: string; onLeave: () => void }) {
  const { user } = useSession();
  const userId = user?.id ?? "";
  const media = useLiveKit(sessionId, Boolean(sessionId));
  const localRef = useRef<HTMLVideoElement | null>(null);
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const join = useJoinRoom();
  const leave = useLeaveRoom();
  const endSession = useEndSession();
  const presence = useReportPresence();
  const chat = useClassroomChat(sessionId);
  const send = useSendClassroomMessage();

  useEffect(() => {
    media.videoRef.current = localRef.current;
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await getById<ClassroomSession>(COLLECTIONS.classroomSessions, sessionId);
        if (!cancelled && row) setSession(row);
      } catch (error) {
        console.error("[gold-live] session load failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!userId || !sessionId) return;
    join.mutate(
      { sessionId, userId, isHost: false },
      { onError: (e) => toast.error(authErrorMessage(e)) },
    );
    presence.mutate({ sessionId, userId });
    // Join once per session mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot join
  }, [sessionId, userId]);

  useEffect(() => {
    if (!media.connected || !userId) return;
    const tick = window.setInterval(() => {
      presence.mutate({ sessionId, userId });
    }, 45_000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- presence mutation is stable enough
  }, [media.connected, sessionId, userId]);

  const isHost = Boolean(session && userId && session.host_id === userId);
  const remotes = Object.values(media.remotes);
  const messages = chat.data ?? [];

  const statusLine = useMemo(() => {
    if (media.connecting) return "Connecting…";
    if (media.connected)
      return isHost ? "You are hosting this Gold lesson." : "You are in the live Gold lesson.";
    return media.error?.message || "Waiting to join.";
  }, [media.connecting, media.connected, media.error, isHost]);

  const handleLeave = () => {
    media.stop();
    if (isHost && session) {
      endSession.mutate(session, {
        onSuccess: () => {
          toast.success("Gold lesson ended.");
          onLeave();
        },
        onError: (e) => {
          toast.error(authErrorMessage(e));
          leave.mutate({ sessionId, userId }, { onSettled: onLeave });
        },
      });
      return;
    }
    leave.mutate({ sessionId, userId }, { onSettled: onLeave });
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    send.mutate(
      { sessionId, senderId: userId, body },
      {
        onSuccess: () => setDraft(""),
        onError: (e) => toast.error(authErrorMessage(e)),
      },
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{statusLine}</p>
        {isHost ? (
          <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
            Host
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <video
          ref={localRef}
          muted
          autoPlay
          playsInline
          className="aspect-video w-full rounded-xl bg-black"
        />
        {media.screenShareOn ? (
          <video
            ref={media.screenVideoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full rounded-xl bg-black"
          />
        ) : null}
        {remotes.map((remote) => (
          <RemoteTile key={remote.identity} video={remote.screenTrack ?? remote.videoTrack} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-full" onClick={() => void media.toggleMic()}>
          {media.micOn ? <Mic className="mr-2 size-4" /> : <MicOff className="mr-2 size-4" />}
          Mic
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => void media.toggleCam()}>
          {media.camOn ? <Video className="mr-2 size-4" /> : <VideoOff className="mr-2 size-4" />}
          Camera
        </Button>
        {media.canShareScreen ? (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => void media.toggleScreenShare()}
          >
            <MonitorUp className="mr-2 size-4" />
            {media.screenShareOn ? "Stop share" : "Share"}
          </Button>
        ) : null}
        <Button variant="outline" className="rounded-full" onClick={() => setChatOpen((v) => !v)}>
          <MessageSquare className="mr-2 size-4" />
          Chat
        </Button>
        <Button variant="destructive" className="rounded-full" onClick={handleLeave}>
          <PhoneOff className="mr-2 size-4" /> {isHost ? "End" : "Leave"}
        </Button>
      </div>
      {chatOpen ? (
        <div className="rounded-xl border border-border bg-background p-3">
          <ScrollArea className="mb-3 h-40 pr-2">
            <ul className="space-y-2">
              {messages.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="font-medium">
                    {m.sender_id === userId ? "You" : "Participant"}
                  </span>
                  <span className="text-muted-foreground"> · {m.body}</span>
                </li>
              ))}
              {!messages.length ? (
                <li className="text-xs text-muted-foreground">No messages yet.</li>
              ) : null}
            </ul>
          </ScrollArea>
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the class"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <Button
              size="icon"
              className="rounded-full"
              disabled={send.isPending || !draft.trim()}
              onClick={handleSend}
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizonal className="size-4" />
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RemoteTile({ video }: { video: RemoteTrack | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !video) return;
    video.attach(el);
    return () => {
      video.detach(el);
    };
  }, [video]);
  return (
    <video ref={ref} autoPlay playsInline className="aspect-video w-full rounded-xl bg-black" />
  );
}
