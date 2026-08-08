import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteParticipant } from "livekit-client";
import { useServerFn } from "@tanstack/react-start";
import { issueClassroomToken } from "@/lib/livekit.functions";

export type MediaError = { kind: "permission" | "config" | "unsupported" | "unknown"; message: string };

function toMediaError(err: unknown): MediaError {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = err instanceof Error ? err.message : "Could not join the live class.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return {
      kind: "permission",
      message: "Camera and microphone access was blocked. Allow it in your browser settings.",
    };
  if (message.includes("not configured"))
    return { kind: "config", message };
  return { kind: "unknown", message };
}

export type RemoteMedia = {
  identity: string;
  videoTrack: RemoteTrack | null;
  audioTrack: RemoteTrack | null;
  speaking: boolean;
};

/**
 * Real-time A/V powered by LiveKit. The access token is minted server-side, so
 * publish rights and room membership are enforced outside the browser.
 */
export function useLiveKit(sessionId: string, enabled = true) {
  const getToken = useServerFn(issueClassroomToken);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [error, setError] = useState<MediaError | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemoteMedia>>({});

  const syncRemotes = useCallback((room: Room) => {
    const next: Record<string, RemoteMedia> = {};
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      next[p.identity] = {
        identity: p.identity,
        videoTrack: p.getTrackPublication(Track.Source.Camera)?.track ?? null,
        audioTrack: p.getTrackPublication(Track.Source.Microphone)?.track ?? null,
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
      try {
        const { token, serverUrl } = await getToken({ data: { sessionId } });
        if (cancelled) return;
        await room.connect(serverUrl, token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        roomRef.current = room;
        setConnected(true);
        setError(null);
        syncRemotes(room);
      } catch (err) {
        if (!cancelled) setError(toMediaError(err));
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
      .on(RoomEvent.Disconnected, () => setConnected(false));

    void connect();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
      setConnected(false);
    };
  }, [sessionId, enabled, getToken, syncRemotes]);

  // Keep the local preview element bound to the published camera track.
  useEffect(() => {
    const track = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    const el = localVideoRef.current;
    if (track && el) track.attach(el);
    return () => {
      if (track && el) track.detach(el);
    };
  }, [camOn, connected]);

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
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const el = localVideoRef.current;
    if (!el || !("pictureInPictureEnabled" in document)) {
      setError({ kind: "unsupported", message: "Picture-in-Picture is not available in this browser." });
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
    remotes,
    connected,
    connecting,
    starting: connecting,
    micOn,
    camOn,
    pipActive,
    error,
    clearError: () => setError(null),
    toggleMic,
    toggleCam,
    forceMute,
    forceCameraOff,
    togglePictureInPicture,
    stop,
  };
}
