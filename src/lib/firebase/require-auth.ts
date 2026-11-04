import "@/lib/node-esm-globals";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AppRole } from "@/types/roles";
import { claimsRoleToAppRole } from "@/types/roles";

export type AuthedContext = {
  userId: string;
  email: string | null;
  role: AppRole;
  schoolId: string | null;
  approved: boolean;
  token: DecodedIdToken;
};

export type OptionalAuthedContext = {
  userId: string | null;
  email: string | null;
  role: AppRole | null;
  schoolId: string | null;
  approved: boolean;
  token: DecodedIdToken | null;
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
    const decoded = await verifyIdToken(token);
    const resolved = await resolveAuthedContext(decoded);

    return next({
      context: resolved satisfies AuthedContext,
    });
  },
);

async function resolveAuthedContext(decoded: DecodedIdToken): Promise<AuthedContext> {
  let role = claimsRoleToAppRole(
    typeof decoded["role"] === "string" ? decoded["role"] : undefined,
  );
  let schoolId = typeof decoded["schoolId"] === "string" ? decoded["schoolId"] : null;
  let approved = decoded["approved"] === true || role !== "teacher";

  // Claims can lag behind Firestore after Google signup or join/approve.
  if (!decoded["role"] || (!schoolId && role === "teacher")) {
    try {
      const { adminGetById } = await import("./admin-repo");
      const { COLLECTIONS } = await import("./collections");
      const profile = await adminGetById<{
        role?: string;
        school_id?: string | null;
        membership_status?: string | null;
      }>(COLLECTIONS.users, decoded.uid);
      if (profile?.role) role = claimsRoleToAppRole(profile.role);
      if (typeof profile?.school_id === "string" && profile.school_id) {
        schoolId = profile.school_id;
      }
      if (profile?.membership_status === "pending") approved = false;
      if (profile?.membership_status === "approved" || profile?.membership_status === "owner") {
        approved = true;
      }
      if (!schoolId) {
        const member = await adminGetById<{
          school_id?: string;
          role?: string;
          status?: string;
        }>(COLLECTIONS.schoolMembers, decoded.uid);
        if (member?.role) role = claimsRoleToAppRole(member.role);
        if (typeof member?.school_id === "string" && member.school_id) schoolId = member.school_id;
        if (member?.status === "pending") approved = false;
        if (member?.status === "approved" || member?.status === "owner") approved = true;
      }
    } catch (error) {
      console.error("[auth] profile/member role resolve failed:", error);
    }
  }

  return {
    userId: decoded.uid,
    email: decoded.email ?? null,
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
      const decoded = await verifyIdToken(token);
      const role = claimsRoleToAppRole(
        typeof decoded["role"] === "string" ? decoded["role"] : undefined,
      );
      const schoolId = typeof decoded["schoolId"] === "string" ? decoded["schoolId"] : null;
      const approved = decoded["approved"] === true || role !== "teacher";
      const signedIn: OptionalAuthedContext = {
        userId: decoded.uid,
        email: decoded.email ?? null,
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
