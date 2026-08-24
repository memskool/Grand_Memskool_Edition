import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
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

function screenShareSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/**
 * Real-time A/V powered by LiveKit. The access token is minted server-side, so
 * publish rights and room membership are enforced outside the browser.
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
        const granted = await getToken({ data: { sessionId } });
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
        syncRemotes(room);
      } catch (err) {
        if (!cancelled) {
          setError(toMediaError(err));
          setStatus("disconnected");
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
      .on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setStatus("disconnected");
        setMicOn(false);
        setCamOn(false);
        setScreenShareOn(false);
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
  }, [sessionId, enabled, getToken, syncRemotes]);

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
  }, [screenShareOn]);

  const forceMute = useCallback(() => {
    void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
    setMicOn(false);
  }, []);

  const forceCameraOff = useCallback(() => {
    void roomRef.current?.localParticipant.setCameraEnabled(false);
    setCamOn(false);
  }, []);

  const stop = useCallback(() => {
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

  return {
    videoRef: localVideoRef,
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
