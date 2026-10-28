import { createMiddleware } from "@tanstack/react-start";
import { getFirebaseAuth } from "@/lib/firebase/client";

/** Attaches the Firebase ID token to every server function RPC. */
export const attachFirebaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    try {
      const auth = getFirebaseAuth();
      await auth.authStateReady();
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      return next({
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Public Home (and other optional RPCs) must still run if token refresh fails.
      return next({ headers: {} });
    }
  },
);
