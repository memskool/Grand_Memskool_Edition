import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";
import { useServerFn } from "@tanstack/react-start";
import { issueClassroomToken } from "@/lib/livekit.functions";

export type MediaError = {
  kind: "permission" | "config" | "unsupported" | "unknown";
  message: string;
};

export type ConnectionStatus =
  "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

function unwrapClassroomToken(raw: unknown): {
  token: string;
  serverUrl: string;
  canShareScreen: boolean;
  canPublish: boolean;
  identity: string;
} {
  let current: unknown = raw;
  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;
    const obj = current as Record<string, unknown>;
    if (typeof obj["token"] === "string" && typeof obj["serverUrl"] === "string") {
      return {
        token: obj["token"],
        serverUrl: obj["serverUrl"],
        canShareScreen: obj["canShareScreen"] === true,
        canPublish: obj["canPublish"] !== false,
        identity: typeof obj["identity"] === "string" ? obj["identity"] : "",
      };
    }
    let advanced = false;
    for (const key of ["data", "result", "payload", "value"]) {
      if (obj[key] && typeof obj[key] === "object") {
        current = obj[key];
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
  }
  throw new Error("Could not get a live video token. Refresh and try again.");
}

function toMediaError(err: unknown): MediaError {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = err instanceof Error ? err.message : "Could not join the live class.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return {
      kind: "permission",
      message: "Camera and microphone access was blocked. Allow it in your browser settings.",
    };
  if (message.includes("not configured")) return { kind: "config", message };
  if (name === "NotFoundError")
    return { kind: "permission", message: "No camera or microphone was found on this device." };
  return { kind: "unknown", message };
}

export type RemoteMedia = {
  identity: string;
  videoTrack: RemoteTrack | null;
  audioTrack: RemoteTrack | null;
  screenTrack: RemoteTrack | null;
  speaking: boolean;
};

/** Reasons a dropped room should NOT auto-rejoin: the user left, was removed, or it ended. */
const FINAL_DISCONNECTS = new Set<DisconnectReason | undefined>([
  DisconnectReason.CLIENT_INITIATED,
  DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.ROOM_DELETED,
  DisconnectReason.ROOM_CLOSED,
]);
/** Rejoin backoff after a full drop (LiveKit already retries short blips itself). */
const REJOIN_DELAYS_MS = [1_500, 3_000, 5_000, 10_000, 15_000, 20_000, 30_000, 30_000];

function screenShareSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/**
 * Real-time A/V powered by LiveKit.
 * Phase 6: token mint enforces enrollment/Gold/suspension + publish/screen-share
 * policy server-side — the browser cannot escalate room rights.
 */
export function useLiveKit(sessionId: string, enabled = true) {
  const getToken = useServerFn(issueClassroomToken);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [error, setError] = useState<MediaError | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemoteMedia>>({});
  const [canShareScreen, setCanShareScreen] = useState(false);
  // Phase 3: auto-rejoin after a full drop so a host's network blip does not end the class.
  const [attempt, setAttempt] = useState(0);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const userStoppedRef = useRef(false);
  const mediaWantedRef = useRef({ mic: false, cam: false });
  const restoreRef = useRef<{ mic: boolean; cam: boolean } | null>(null);
  const [rejoinExhausted, setRejoinExhausted] = useState(false);

  useEffect(() => {
    mediaWantedRef.current = { mic: micOn, cam: camOn };
  }, [micOn, camOn]);

  useEffect(() => {
    userStoppedRef.current = false;
    retriesRef.current = 0;
    restoreRef.current = null;
    setRejoinExhausted(false);
  }, [sessionId]);

  const scheduleRejoin = useCallback(() => {
    if (userStoppedRef.current || retryTimerRef.current !== null) return;
    const n = retriesRef.current;
    if (n >= REJOIN_DELAYS_MS.length) {
      setRejoinExhausted(true);
      return;
    }
    retriesRef.current = n + 1;
    setStatus("reconnecting");
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setAttempt((a) => a + 1);
    }, REJOIN_DELAYS_MS[n]);
  }, []);

  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    },
    [],
  );

  // Network came back: try straight away instead of waiting out the backoff.
  useEffect(() => {
    const onOnline = () => {
      if (userStoppedRef.current || roomRef.current) return;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      retriesRef.current = 0;
      setRejoinExhausted(false);
      setAttempt((a) => a + 1);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const syncRemotes = useCallback((room: Room) => {
    const next: Record<string, RemoteMedia> = {};
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      next[p.identity] = {
        identity: p.identity,
        videoTrack: p.getTrackPublication(Track.Source.Camera)?.track ?? null,
        audioTrack: p.getTrackPublication(Track.Source.Microphone)?.track ?? null,
        screenTrack: p.getTrackPublication(Track.Source.ScreenShare)?.track ?? null,
        speaking: p.isSpeaking,
      };
    });
    setRemotes(next);
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });

    const connect = async () => {
      setConnecting(true);
      setStatus("connecting");
      try {
        const raw = await getToken({ data: { sessionId } });
        const granted = unwrapClassroomToken(raw);
        if (cancelled) return;
        setCanShareScreen(granted.canShareScreen);
        await room.connect(granted.serverUrl, granted.token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        roomRef.current = room;
        setConnected(true);
        setStatus("connected");
        setError(null);
        retriesRef.current = 0;
        setRejoinExhausted(false);
        syncRemotes(room);
        // After an automatic rejoin, turn back on what the user had on before the drop.
        const restore = restoreRef.current;
        restoreRef.current = null;
        if (restore?.mic) {
          await room.localParticipant
            .setMicrophoneEnabled(true)
            .then(() => setMicOn(true))
            .catch(() => undefined);
        }
        if (restore?.cam) {
          await room.localParticipant
            .setCameraEnabled(true)
            .then(() => setCamOn(true))
            .catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) {
          if (attempt > 0 && !userStoppedRef.current) {
            // A rejoin failed (often still offline): keep trying on the backoff.
            scheduleRejoin();
          } else {
            setError(toMediaError(err));
            setStatus("disconnected");
          }
        }
      } finally {
        if (!cancelled) setConnecting(false);
      }
    };

    const refresh = () => syncRemotes(room);
    room
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.Reconnecting, () => setStatus("reconnecting"))
      .on(RoomEvent.Reconnected, () => {
        setStatus("connected");
        setConnected(true);
        setError(null);
      })
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        const wanted = mediaWantedRef.current;
        setConnected(false);
        setStatus("disconnected");
        setMicOn(false);
        setCamOn(false);
        setScreenShareOn(false);
        if (roomRef.current === room) roomRef.current = null;
        if (cancelled || userStoppedRef.current || FINAL_DISCONNECTS.has(reason)) return;
        restoreRef.current = { mic: wanted.mic, cam: wanted.cam };
        scheduleRejoin();
      })
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Reconnecting) setStatus("reconnecting");
        if (state === ConnectionState.Connected) setStatus("connected");
        if (state === ConnectionState.Disconnected) setStatus("disconnected");
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) setScreenShareOn(false);
      });

    void connect();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
      setConnected(false);
      setStatus("disconnected");
    };
  }, [sessionId, enabled, getToken, syncRemotes, attempt, scheduleRejoin]);

  useEffect(() => {
    const track = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    const el = localVideoRef.current;
    if (track && el) track.attach(el);
    return () => {
      if (track && el) track.detach(el);
    };
  }, [camOn, connected]);

  useEffect(() => {
    const track = roomRef.current?.localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    )?.track;
    const el = screenVideoRef.current;
    if (track && el) track.attach(el);
    return () => {
      if (track && el) track.detach(el);
    };
  }, [screenShareOn, connected]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      return next;
    } catch (err) {
      setError(toMediaError(err));
      return micOn;
    }
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;
    const next = !camOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamOn(next);
      return next;
    } catch (err) {
      setError(toMediaError(err));
      return camOn;
    }
  }, [camOn]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;
    // Token canPublishSources already blocks non-hosts; mirror that in UI.
    if (!canShareScreen) {
      setError({
        kind: "permission",
        message: "Only the host can share their screen in this class.",
      });
      return false;
    }
    if (!screenShareSupported()) {
      setError({
        kind: "unsupported",
        message: "Screen sharing is not available in this browser. Use a desktop browser.",
      });
      return false;
    }
    const next = !screenShareOn;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenShareOn(next);
      return next;
    } catch (err) {
      setError(toMediaError(err));
      return screenShareOn;
    }
  }, [screenShareOn, canShareScreen]);

  const forceMute = useCallback(() => {
    void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
    setMicOn(false);
  }, []);

  const forceCameraOff = useCallback(() => {
    void roomRef.current?.localParticipant.setCameraEnabled(false);
    setCamOn(false);
  }, []);

  const stop = useCallback(() => {
    userStoppedRef.current = true;
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    void roomRef.current?.disconnect();
    setConnected(false);
    setMicOn(false);
    setCamOn(false);
    setScreenShareOn(false);
    setStatus("disconnected");
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const el = localVideoRef.current;
    if (!el || !("pictureInPictureEnabled" in document)) {
      setError({
        kind: "unsupported",
        message: "Picture-in-Picture is not available in this browser.",
      });
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
      } else {
        await el.requestPictureInPicture();
        setPipActive(true);
      }
    } catch {
      setError({ kind: "unsupported", message: "Picture-in-Picture could not be started." });
    }
  }, []);

  /** Manual "Rejoin" after automatic retries gave up (or any time the room is down). */
  const reconnect = useCallback(() => {
    userStoppedRef.current = false;
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retriesRef.current = 0;
    setRejoinExhausted(false);
    setError(null);
    // Keep what was on before the drop (state was already cleared by the disconnect).
    restoreRef.current ??= { ...mediaWantedRef.current };
    setAttempt((a) => a + 1);
  }, []);

  return {
    videoRef: localVideoRef,
    reconnect,
    rejoinExhausted,
    screenVideoRef,
    remotes,
    connected,
    connecting,
    starting: connecting,
    status,
    micOn,
    camOn,
    screenShareOn,
    canShareScreen,
    screenShareSupported: screenShareSupported(),
    pipActive,
    error,
    clearError: () => setError(null),
    toggleMic,
    toggleCam,
    toggleScreenShare,
    forceMute,
    forceCameraOff,
    togglePictureInPicture,
    stop,
  };
}
