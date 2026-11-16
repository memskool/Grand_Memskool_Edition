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

/** Memskool uses the named Enterprise database `default`, not `(default)`. */
const DATABASE_ID = "default";
const db = () => getFirestore(DATABASE_ID);

/** Roles that manage a school (claims store institution as `admin`). */
const SCHOOL_MANAGERS = new Set(["admin", "institution"]);
/** Roles a school manager may sync onto members of their own school. */
const MEMBER_ROLES = new Set(["student", "teacher", "parent"]);

/**
 * Append an audit_logs row (Admin SDK only).
 * @param {object} entry Audit fields.
 */
async function writeAudit(entry: {
  type: string;
  actorId?: string | null;
  schoolId?: string | null;
  targetId?: string | null;
  summary: string;
}) {
  await db().collection("audit_logs").add({
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
  {document: "notifications/{id}", database: DATABASE_ID},
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const userId = String(data.user_id ?? "");
    if (!userId) return;

    const store = db();
    const prefsSnap = await store
      .collection("notification_preferences")
      .doc(userId)
      .get();
    const prefs = prefsSnap.data() ?? {email_enabled: true, sms_enabled: false};
    const userSnap = await store.collection("users").doc(userId).get();
    const user = userSnap.data() ?? {};

    const deliveries = store.collection("notification_deliveries");
    const now = new Date().toISOString();
    const hasEmail = typeof user.email === "string" && user.email;
    if (prefs.email_enabled !== false && hasEmail) {
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
    const hasPhone = typeof user.phone === "string" && user.phone;
    if (prefs.sms_enabled === true && hasPhone) {
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

    const tokensSnap = await store
      .collection("fcm_tokens").where("user_id", "==", userId).limit(10).get();
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
  {document: "disciplinary_actions/{id}", database: DATABASE_ID},
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
 * Callable used by school operators to re-sync a member's custom claims from
 * their profile. School managers may only sync student/teacher/parent members
 * of their own school; only superadmin may sync manager roles or any school.
 * Superadmin is never assignable through this callable.
 */
export const refreshUserClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const callerRole = String(request.auth.token.role ?? "");
  const tokenSchool = request.auth.token.schoolId;
  const callerSchool = typeof tokenSchool === "string" ? tokenSchool : "";
  const isSuper = callerRole === "superadmin";
  if (!isSuper && !SCHOOL_MANAGERS.has(callerRole)) {
    throw new HttpsError("permission-denied", "Not allowed.");
  }
  const uid = String(request.data?.uid ?? "");
  if (!uid) throw new HttpsError("invalid-argument", "uid required.");

  const userSnap = await db().collection("users").doc(uid).get();
  const user = userSnap.data();
  if (!user) throw new HttpsError("not-found", "User profile missing.");

  let role = String(user.role ?? "student");
  if (role === "superadmin") {
    throw new HttpsError("permission-denied", "Cannot assign superadmin.");
  }
  if (role === "institution") role = "admin";
  const schoolId =
    typeof user.school_id === "string" && user.school_id ?
      user.school_id :
      null;

  if (!isSuper) {
    if (!callerSchool || schoolId !== callerSchool) {
      throw new HttpsError(
        "permission-denied",
        "That user is not in your school.",
      );
    }
    if (!MEMBER_ROLES.has(role)) {
      throw new HttpsError("permission-denied", "Not allowed.");
    }
  }

  await getAuth().setCustomUserClaims(uid, {
    role,
    schoolId,
    approved:
      role !== "teacher" ||
      user.membership_status === "approved" ||
      user.membership_status === "owner",
  });
  await getAuth().revokeRefreshTokens(uid).catch(() => undefined);
  await writeAudit({
    type: "claims.refreshed",
    actorId: request.auth.uid,
    schoolId,
    targetId: uid,
    summary: `claims synced to ${role}`,
  });
  return {ok: true};
});

export const ping = onCall(async () => ({ok: true, ts: Date.now()}));
