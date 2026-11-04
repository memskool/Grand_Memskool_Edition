import "@tanstack/react-start/server-only";

/**
 * Verify Firebase ID tokens with Google's JWKS via `jose`.
 * Avoids `firebase-admin` on the live-classroom path (Admin SDK hits
 * `__dirname is not defined` when Nitro bundles it as ESM on Vercel).
 */
export type JoseAuthedUser = {
  userId: string;
  email: string | null;
  role: string | null;
  schoolId: string | null;
  approved: boolean;
};

let jwks: Awaited<ReturnType<typeof import("jose").createRemoteJWKSet>> | null = null;

async function getJwks() {
  if (jwks) return jwks;
  const { createRemoteJWKSet } = await import("jose");
  jwks = createRemoteJWKSet(
    new URL(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    ),
  );
  return jwks;
}

export async function verifyFirebaseIdTokenWithJose(idToken: string): Promise<JoseAuthedUser> {
  const projectId =
    process.env["VITE_FIREBASE_PROJECT_ID"] || process.env["GCLOUD_PROJECT"] || "memskool-4e193";
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(idToken, await getJwks(), {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) throw new Error("Unauthorized: Invalid token subject.");
  const role = typeof payload["role"] === "string" ? payload["role"] : null;
  const schoolId = typeof payload["schoolId"] === "string" ? payload["schoolId"] : null;
  const approved = payload["approved"] === true || role !== "teacher";
  const email = payload["email"];
  return {
    userId,
    email: typeof email === "string" ? email : null,
    role,
    schoolId,
    approved,
  };
}
