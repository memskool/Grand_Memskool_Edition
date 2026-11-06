import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { AppRole } from "@/types/roles";
import { claimsRoleToAppRole } from "@/types/roles";

/** Minimal token shape — avoid importing firebase-admin types into client-reachable modules. */
export type AuthedToken = {
  uid: string;
  email?: string | null;
  role?: unknown;
  schoolId?: unknown;
  approved?: unknown;
};

export type AuthedContext = {
  userId: string;
  email: string | null;
  role: AppRole;
  schoolId: string | null;
  approved: boolean;
  token: AuthedToken;
};

export type OptionalAuthedContext = {
  userId: string | null;
  email: string | null;
  role: AppRole | null;
  schoolId: string | null;
  approved: boolean;
  token: AuthedToken | null;
};

export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No authorization header provided");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) throw new Error("Unauthorized: No token provided");

    const { verifyIdToken } = await import("./admin.server");
    const decoded = (await verifyIdToken(token)) as AuthedToken;
    const resolved = await resolveAuthedContext(decoded);

    return next({
      context: resolved satisfies AuthedContext,
    });
  },
);

async function resolveAuthedContext(decoded: AuthedToken): Promise<AuthedContext> {
  let role = claimsRoleToAppRole(typeof decoded.role === "string" ? decoded.role : undefined);
  let schoolId = typeof decoded.schoolId === "string" ? decoded.schoolId : null;
  // Phase 2: teachers need an explicit approved claim; other roles default approved.
  let approved =
    decoded.approved === true || (typeof decoded.role === "string" && decoded.role !== "teacher");

  // Heal only when the role claim is missing (claims lag right after signup).
  // Never promote privilege from users/{uid}.role when claims already set a role.
  if (!decoded.role) {
    try {
      const { adminGetById } = await import("./admin-repo");
      const { COLLECTIONS } = await import("./collections");
      const profile = await adminGetById<{
        role?: string;
        school_id?: string | null;
        membership_status?: string | null;
      }>(COLLECTIONS.users, decoded.uid);
      if (profile?.role) role = claimsRoleToAppRole(profile.role);
      const membership = profile?.membership_status ?? null;
      if (membership === "pending") {
        approved = false;
        schoolId = null;
      } else if (membership === "rejected") {
        approved = true;
        schoolId = null;
      } else if (membership === "approved" || membership === "owner") {
        approved = true;
        if (typeof profile?.school_id === "string" && profile.school_id) {
          schoolId = profile.school_id;
        }
      }
    } catch (error) {
      console.error("[auth] profile role resolve failed:", error);
    }
  } else if (role === "teacher" && decoded.approved !== true) {
    // Claims may lag after admin approval — heal schoolId only for approved members.
    try {
      const { adminGetById } = await import("./admin-repo");
      const { COLLECTIONS } = await import("./collections");
      const profile = await adminGetById<{
        school_id?: string | null;
        membership_status?: string | null;
      }>(COLLECTIONS.users, decoded.uid);
      const membership = profile?.membership_status ?? null;
      if (membership === "pending" || membership === "rejected") {
        approved = membership !== "rejected" ? false : true;
        schoolId = null;
      } else if (membership === "approved" || membership === "owner") {
        approved = true;
        if (typeof profile?.school_id === "string" && profile.school_id) {
          schoolId = profile.school_id;
        }
      } else {
        // No membership row: keep claim schoolId null and unapproved for teachers.
        approved = false;
        if (!schoolId) schoolId = null;
      }
    } catch (error) {
      console.error("[auth] teacher approval heal failed:", error);
    }
  }

  return {
    userId: decoded.uid,
    email: typeof decoded.email === "string" ? decoded.email : null,
    role,
    schoolId,
    approved,
    token: decoded,
  };
}

/** Public Home feed can run signed-out; likes and uploads still use requireFirebaseAuth. */
export const optionalFirebaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const header = request.headers.get("authorization");
    const empty: OptionalAuthedContext = {
      userId: null,
      email: null,
      role: null,
      schoolId: null,
      approved: false,
      token: null,
    };
    if (!header?.startsWith("Bearer ")) {
      return next({ context: empty });
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) return next({ context: empty });
    try {
      const { verifyIdToken } = await import("./admin.server");
      const decoded = (await verifyIdToken(token)) as AuthedToken;
      const role = claimsRoleToAppRole(typeof decoded.role === "string" ? decoded.role : undefined);
      const schoolId = typeof decoded.schoolId === "string" ? decoded.schoolId : null;
      const approved =
        decoded.approved === true ||
        (typeof decoded.role === "string" && decoded.role !== "teacher");
      const signedIn: OptionalAuthedContext = {
        userId: decoded.uid,
        email: typeof decoded.email === "string" ? decoded.email : null,
        role,
        schoolId,
        approved,
        token: decoded,
      };
      return next({ context: signedIn });
    } catch {
      return next({ context: empty });
    }
  },
);
