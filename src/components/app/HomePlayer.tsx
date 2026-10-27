import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  Flag,
  Heart,
  Maximize,
  Pause,
  Play,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useAuth";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  homeSubjectLabel,
  useHomeLike,
  useHomeReport,
  useHomeSave,
  useHomeView,
} from "@/lib/home-data";
import type { HomeVideoCard } from "@/features/home/types";
import { HOME_REPORT_REASONS } from "@/features/home/policy";

export function HomePlayer({ video, active }: { video: HomeVideoCard; active: boolean }) {
  const { user } = useSession();
  const media = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(Boolean(video.liked));
  const [saved, setSaved] = useState(Boolean(video.saved));
  const [reportOpen, setReportOpen] = useState(false);
  const like = useHomeLike();
  const save = useHomeSave();
  const view = useHomeView();
  const report = useHomeReport();
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = media.current;
    if (!el) return;
    if (!active) {
      el.pause();
      setPlaying(false);
      return;
    }
    if (reduced) return;
    el.muted = true;
    setMuted(true);
    void el.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
    if (user) view.mutate(video.id);
    // Count at most once per mount of an active clip; mutate identity is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, video.id, user?.id, reduced]);

  function togglePlay() {
    const el = media.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/home/${video.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.message("Sharing cancelled");
    }
  }

  return (
    <article className="relative flex h-[min(86dvh,760px)] w-full max-w-[420px] snap-start flex-col overflow-hidden rounded-xl bg-black text-white shadow-md">
      {video.playback_url ? (
        <video
          ref={media}
          className="absolute inset-0 size-full object-cover"
          src={video.playback_url}
          poster={video.thumbnail_url ?? undefined}
          playsInline
          loop
          muted={muted}
          preload="metadata"
          onClick={togglePlay}
          aria-label={video.title}
        >
          {video.caption_url ? (
            <track kind="captions" src={video.caption_url} srcLang="en" default />
          ) : null}
        </video>
      ) : (
        <div className="flex size-full items-center justify-center px-6 text-center text-sm text-white/80">
          This clip is approved, but a playable file is not available on this server yet.
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      <div className="relative mt-auto flex items-end justify-between gap-3 p-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-gold">
            {homeSubjectLabel(video.subject)}
          </p>
          <h2 className="font-display text-lg font-semibold leading-tight">{video.title}</h2>
          <p className="line-clamp-3 text-sm text-white/80">{video.description}</p>
          <p className="text-sm">
            <Link
              className="underline-offset-2 hover:underline"
              to="/home/creator/$creatorId"
              params={{ creatorId: video.creator_id }}
            >
              {video.creator_name}
            </Link>
            {video.school_id && video.school_name ? (
              <>
                {" · "}
                <Link
                  className="underline-offset-2 hover:underline"
                  to="/home/channel/$schoolId"
                  params={{ schoolId: video.school_id }}
                >
                  {video.school_name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <IconAction
            label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
            icon={playing ? Pause : Play}
          />
          <IconAction
            label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              const el = media.current;
              if (!el) return;
              el.muted = !el.muted;
              setMuted(el.muted);
            }}
            icon={muted ? VolumeX : Volume2}
          />
          <IconAction
            label="Like"
            onClick={() => {
              if (!user) {
                toast.message("Sign in to like videos.");
                return;
              }
              like.mutate(video.id, {
                onSuccess: (result) => setLiked(Boolean((result as { liked?: boolean }).liked)),
                onError: (error) => toast.error(authErrorMessage(error)),
              });
            }}
            icon={Heart}
            active={liked}
          />
          <span className="text-[11px] text-white/80">
            {video.like_count + (liked && !video.liked ? 1 : 0)}
          </span>
          <IconAction
            label="Save to Locker"
            onClick={() => {
              if (!user) {
                toast.message("Sign in to save videos.");
                return;
              }
              save.mutate(video.id, {
                onSuccess: (result) => {
                  setSaved(Boolean((result as { saved?: boolean }).saved));
                  toast.success("Saved to your Locker");
                },
                onError: (error) => toast.error(authErrorMessage(error)),
              });
            }}
            icon={Bookmark}
            active={saved}
          />
          <IconAction label="Share" onClick={() => void share()} icon={Share2} />
          <IconAction label="Report" onClick={() => setReportOpen((open) => !open)} icon={Flag} />
          <IconAction
            label="Fullscreen"
            onClick={() => {
              const el = media.current;
              if (!el) return;
              void el.requestFullscreen?.();
            }}
            icon={Maximize}
          />
        </div>
      </div>

      {reportOpen ? (
        <form
          className="relative z-10 space-y-2 bg-black/80 p-4 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (!user) {
              toast.message("Sign in to report a video.");
              return;
            }
            const form = new FormData(event.currentTarget);
            report.mutate(
              {
                videoId: video.id,
                reason: String(form.get("reason")) as (typeof HOME_REPORT_REASONS)[number],
                details: String(form.get("details") || "").trim() || null,
              },
              {
                onSuccess: () => {
                  toast.success("Report sent to platform operators");
                  setReportOpen(false);
                },
                onError: (error) => toast.error(authErrorMessage(error)),
              },
            );
          }}
        >
          <label className="block">
            Why are you reporting this?
            <select name="reason" className="mt-1 w-full rounded-md bg-white/10 p-2">
              {HOME_REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <textarea
            name="details"
            className="w-full rounded-md bg-white/10 p-2"
            placeholder="Optional details"
          />
          <Button type="submit" size="sm">
            Send report
          </Button>
        </form>
      ) : null}
    </article>
  );
}

function IconAction({
  label,
  onClick,
  icon: Icon,
  active,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Play;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex size-10 items-center justify-center rounded-full bg-white/15 backdrop-blur ${active ? "text-gold" : ""}`}
    >
      <Icon className="size-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}
