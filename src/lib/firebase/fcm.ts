import type { Messaging } from "firebase/messaging";
import { getFirebaseApp, getFirebaseAuth } from "@/lib/firebase/client";
import { getFirebaseWebConfig } from "@/lib/firebase/config";
import { COLLECTIONS, setById } from "@/lib/firebase/repo";

let messaging: Messaging | undefined;

export type PushState =
  | "unsupported" // browser has no push, or the VAPID key is not configured
  | "default" // not asked yet: show the "Turn on alerts" button
  | "granted"
  | "denied";

function vapidKey(): string | undefined {
  const key = import.meta.env["VITE_FIREBASE_VAPID_KEY"] as string | undefined;
  return key?.trim() || undefined;
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (!("serviceWorker" in navigator) || !vapidKey()) return "unsupported";
  // Messaging SDK loads only after the cheap checks pass (keeps it off every page load).
  const { isSupported } = await import("firebase/messaging");
  if (!(await isSupported().catch(() => false))) return "unsupported";
  return Notification.permission as PushState;
}

async function messagingWorker(): Promise<ServiceWorkerRegistration> {
  const cfg = getFirebaseWebConfig();
  const qs = new URLSearchParams({
    apiKey: cfg.apiKey,
    projectId: cfg.projectId,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs.toString()}`, {
    scope: "/firebase-cloud-messaging-push-scope",
  });
}

/**
 * Saves this browser's push token for the signed-in user. Without `prompt` it never asks
 * for permission (browsers penalise prompts on page load) and only refreshes the token
 * when the user already allowed alerts. Returns the resulting permission state.
 */
export async function registerFcmToken(opts: { prompt?: boolean } = {}): Promise<PushState> {
  const state = await pushState();
  if (state === "unsupported" || state === "denied") return state;
  if (state === "default") {
    if (!opts.prompt) return state;
    const answer = await Notification.requestPermission();
    if (answer !== "granted") return answer as PushState;
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) return "granted";
  const { getMessaging, getToken } = await import("firebase/messaging");
  messaging ??= getMessaging(getFirebaseApp());
  const token = await getToken(messaging, {
    vapidKey: vapidKey()!,
    serviceWorkerRegistration: await messagingWorker(),
  });
  if (token) {
    await setById(COLLECTIONS.fcmTokens, `${user.uid}_${token.slice(-12)}`, {
      user_id: user.uid,
      token,
      updated_at: new Date().toISOString(),
    });
  }
  return "granted";
}
