import { AppError, classifyFirebase, toUserMessage } from "@/lib/errors/app-error";

/**
 * User-facing authentication copy. Never surface raw Firebase codes.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";
  const raw = `${code} ${error instanceof Error ? error.message : String(error)}`;
  const m = raw.toLowerCase();
  if (
    m.includes("auth/invalid-credential") ||
    m.includes("auth/invalid-login-credentials") ||
    m.includes("auth/wrong-password") ||
    m.includes("auth/user-not-found") ||
    m.includes("no user record corresponding")
  ) {
    return "The email or password is incorrect.";
  }
  if (m.includes("auth/too-many-requests")) {
    return "Too many attempts just now. Please wait a moment and try again.";
  }
  if (m.includes("auth/email-already-in-use")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (m.includes("auth/weak-password")) {
    return "Passwords must be at least 6 characters.";
  }
  if (m.includes("auth/invalid-email")) {
    return "Enter a valid email address.";
  }
  if (m.includes("unauthorized-continue-uri") || m.includes("continue url")) {
    return "This app address is not allowed for email links yet. Add it in Firebase Authentication authorized domains.";
  }
  if (m.includes("auth/popup-closed-by-user") || m.includes("auth/cancelled-popup-request")) {
    return "Google sign-in was cancelled.";
  }
  if (m.includes("auth/account-exists-with-different-credential")) {
    return "That email is already used with a different sign-in method. Use email and password, or the original provider.";
  }
  if (m.includes("auth/requires-recent-login")) {
    return "For security, sign in again before changing your password.";
  }
  if (m.includes("permission-denied") || m.includes("missing or insufficient permissions")) {
    return "You do not have permission to perform this action.";
  }
  if (m.includes("network") || m.includes("unavailable") || m.includes("failed to fetch")) {
    return "Network problem. Check your connection and try again.";
  }
  return toUserMessage(error);
}

export function asAuthError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return classifyFirebase(error);
}
