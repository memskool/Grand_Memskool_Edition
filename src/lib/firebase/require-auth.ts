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
    const role = claimsRoleToAppRole(
      typeof decoded["role"] === "string" ? decoded["role"] : undefined,
    );
    const schoolId = typeof decoded["schoolId"] === "string" ? decoded["schoolId"] : null;
    const approved = decoded["approved"] === true || role !== "teacher";

    return next({
      context: {
        userId: decoded.uid,
        email: decoded.email ?? null,
        role,
        schoolId,
        approved,
        token: decoded,
      } satisfies AuthedContext,
    });
  },
);

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
