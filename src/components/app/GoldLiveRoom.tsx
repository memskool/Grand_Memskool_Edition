import { useEffect, useRef } from "react";
import type { RemoteTrack } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useLiveKit } from "@/hooks/useLiveKit";
import { Button } from "@/components/ui/button";

export function GoldLiveRoom({ sessionId, onLeave }: { sessionId: string; onLeave: () => void }) {
  const media = useLiveKit(sessionId, true);
  const localRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    media.videoRef.current = localRef.current;
  });

  const remotes = Object.values(media.remotes);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-secondary/40 p-4">
      <p className="text-sm text-muted-foreground">
        {media.connecting
          ? "Connecting…"
          : media.connected
            ? "You are in the live Gold lesson."
            : media.error?.message || "Waiting to join."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <video
          ref={localRef}
          muted
          autoPlay
          playsInline
          className="aspect-video w-full rounded-xl bg-black"
        />
        {remotes.map((remote) => (
          <RemoteTile key={remote.identity} video={remote.videoTrack} />
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
        <Button
          variant="destructive"
          className="rounded-full"
          onClick={() => {
            media.stop();
            onLeave();
          }}
        >
          <PhoneOff className="mr-2 size-4" /> Leave
        </Button>
      </div>
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
