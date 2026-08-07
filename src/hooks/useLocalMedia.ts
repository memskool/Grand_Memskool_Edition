import { useCallback, useEffect, useRef, useState } from "react";

export type MediaError = { kind: "permission" | "notfound" | "unsupported" | "unknown"; message: string };

function toMediaError(err: unknown): MediaError {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return { kind: "permission", message: "Camera and microphone access was blocked. Allow it in your browser settings." };
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return { kind: "notfound", message: "No camera or microphone was found on this device." };
  if (name === "NotReadableError")
    return { kind: "unknown", message: "Your camera or microphone is already in use by another app." };
  return { kind: "unknown", message: "Could not start your camera or microphone." };
}

/**
 * Local WebRTC media state. Wraps getUserMedia with graceful permission /
 * device-error handling, plus a Picture-in-Picture escape hatch so audio keeps
 * playing while the learner browses other tabs.
 */
export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<MediaError | null>(null);
  const [pipActive, setPipActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    if (!supported) {
      setError({ kind: "unsupported", message: "This browser does not support live video." });
      return null;
    }
    setStarting(true);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      next.getAudioTracks().forEach((t) => (t.enabled = false));
      next.getVideoTracks().forEach((t) => (t.enabled = false));
      streamRef.current = next;
      setStream(next);
      setError(null);
      return next;
    } catch (err) {
      setError(toMediaError(err));
      return null;
    } finally {
      setStarting(false);
    }
  }, [supported]);

  const toggleMic = useCallback(async () => {
    const s = await ensureStream();
    if (!s) return false;
    const next = !micOn;
    s.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    return next;
  }, [ensureStream, micOn]);

  const toggleCam = useCallback(async () => {
    const s = await ensureStream();
    if (!s) return false;
    const next = !camOn;
    s.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
    return next;
  }, [ensureStream, camOn]);

  const forceMute = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    setMicOn(false);
  }, []);

  const forceCameraOff = useCallback(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
    setCamOn(false);
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setMicOn(false);
    setCamOn(false);
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const el = videoRef.current;
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

  useEffect(() => () => stop(), [stop]);

  return {
    stream,
    videoRef,
    micOn,
    camOn,
    starting,
    error,
    supported,
    pipActive,
    clearError: () => setError(null),
    ensureStream,
    toggleMic,
    toggleCam,
    forceMute,
    forceCameraOff,
    togglePictureInPicture,
    stop,
  };
}
