import {setGlobalOptions} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

initializeApp();
setGlobalOptions({maxInstances: 10, region: "africa-south1"});

const PRIVILEGED = new Set(["admin", "institution", "superadmin", "teacher"]);

async function writeAudit(entry: {
  type: string;
  actorId?: string | null;
  schoolId?: string | null;
  targetId?: string | null;
  summary: string;
}) {
  await getFirestore().collection("audit_logs").add({
    type: entry.type,
    actor_id: entry.actorId ?? null,
    school_id: entry.schoolId ?? null,
    target_id: entry.targetId ?? null,
    summary: entry.summary,
    created_at: new Date().toISOString(),
  });
}

/**
 * Fan-out: each in-app notification becomes email/SMS delivery rows
 * (Admin SDK only) plus an FCM multicast when tokens exist.
 */
export const onNotificationCreated = onDocumentCreated(
  "notifications/{id}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const userId = String(data.user_id ?? "");
    if (!userId) return;

    const db = getFirestore();
    const prefsSnap = await db.collection("notification_preferences").doc(userId).get();
    const prefs = prefsSnap.data() ?? {email_enabled: true, sms_enabled: false};
    const userSnap = await db.collection("users").doc(userId).get();
    const user = userSnap.data() ?? {};

    const deliveries = db.collection("notification_deliveries");
    const now = new Date().toISOString();
    if (prefs.email_enabled !== false && typeof user.email === "string" && user.email) {
      await deliveries.add({
        notification_id: snap.id,
        user_id: userId,
        channel: "email",
        destination: user.email,
        status: "pending",
        attempts: 0,
        next_attempt_at: now,
        created_at: now,
      });
    }
    if (prefs.sms_enabled === true && typeof user.phone === "string" && user.phone) {
      await deliveries.add({
        notification_id: snap.id,
        user_id: userId,
        channel: "sms",
        destination: user.phone,
        status: "pending",
        attempts: 0,
        next_attempt_at: now,
        created_at: now,
      });
    }

    const tokensSnap = await db.collection("fcm_tokens").where("user_id", "==", userId).limit(10).get();
    const tokens = tokensSnap.docs
      .map((d) => String(d.data().token ?? ""))
      .filter(Boolean);
    if (!tokens.length) return;
    try {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: {
          title: String(data.title ?? "Memskool"),
          body: String(data.body ?? "").slice(0, 180),
        },
        data: {
          kind: String(data.kind ?? ""),
          link: String(data.link ?? "/dashboard"),
        },
      });
    } catch (error) {
      logger.warn("FCM send failed", error);
    }
  },
);

export const onDisciplinaryActionCreated = onDocumentCreated(
  "disciplinary_actions/{id}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    await writeAudit({
      type: "discipline.issued",
      actorId: typeof data.issued_by === "string" ? data.issued_by : null,
      schoolId: typeof data.school_id === "string" ? data.school_id : null,
      targetId: typeof data.student_id === "string" ? data.student_id : null,
      summary: `${String(data.kind ?? "action")} issued`,
    });
  },
);

/**
 * Callable used by privileged operators to refresh custom claims.
 * Superadmin cannot be self-assigned.
 */
export const refreshUserClaims = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const callerRole = String(request.auth.token.role ?? "");
  if (!PRIVILEGED.has(callerRole) && callerRole !== "superadmin") {
    throw new HttpsError("permission-denied", "Not allowed.");
  }
  const uid = String(request.data?.uid ?? "");
  if (!uid) throw new HttpsError("invalid-argument", "uid required.");

  const userSnap = await getFirestore().collection("users").doc(uid).get();
  const user = userSnap.data();
  if (!user) throw new HttpsError("not-found", "User profile missing.");

  let role = String(user.role ?? "student");
  if (role === "superadmin" && callerRole !== "superadmin") {
    throw new HttpsError("permission-denied", "Cannot assign superadmin.");
  }
  if (role === "institution") role = "admin";

  await getAuth().setCustomUserClaims(uid, {
    role,
    schoolId: user.school_id ?? null,
    approved: user.membership_status === "approved" || role !== "teacher",
  });
  await getAuth().revokeRefreshTokens(uid).catch(() => undefined);
  return {ok: true};
});

export const ping = onCall(async () => ({ok: true, ts: Date.now()}));
