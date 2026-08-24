import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";
import { getFirebaseApp, getFirebaseAuth } from "@/lib/firebase/client";
import { COLLECTIONS, setById } from "@/lib/firebase/repo";

let messaging: Messaging | undefined;

export async function registerFcmToken(): Promise<void> {
  if (typeof window === "undefined") return;
  const vapid = import.meta.env["VITE_FIREBASE_VAPID_KEY"] as string | undefined;
  if (!vapid) return;
  if (!(await isSupported())) return;
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  messaging ??= getMessaging(getFirebaseApp());
  const token = await getToken(messaging, { vapidKey: vapid });
  if (!token) return;
  await setById(COLLECTIONS.fcmTokens, `${user.uid}_${token.slice(-12)}`, {
    user_id: user.uid,
    token,
    updated_at: new Date().toISOString(),
  });
}
