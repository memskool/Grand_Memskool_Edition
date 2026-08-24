export type AppErrorCode =
  "auth" | "permission" | "validation" | "network" | "not_found" | "rate_limit" | "unexpected";

export class AppError extends Error {
  readonly code: AppErrorCode;
  override readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

function firebaseErrorText(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";
  const message = error instanceof Error && error.message ? error.message : String(error);
  return `${code} ${message}`.trim();
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return mapFirebaseMessage(firebaseErrorText(error));
}

export function mapFirebaseMessage(raw: string): string {
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
  if (m.includes("auth/configuration-not-found") || m.includes("configuration_not_found")) {
    return "Sign-in isn't available right now. Refresh the page and try again.";
  }
  if (m.includes("auth/email-already-in-use")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (m.includes("auth/weak-password")) {
    return "Passwords must be at least 6 characters.";
  }
  if (m.includes("auth/too-many-requests")) {
    return "Too many attempts just now. Please wait a moment and try again.";
  }
  if (m.includes("auth/invalid-action-code") || m.includes("auth/expired-action-code")) {
    return "That link has expired or was already used. Request a new one.";
  }
  if (
    m.includes("auth/network-request-failed") ||
    m.includes("failed to fetch") ||
    m.includes("unavailable") ||
    m.includes("offline") ||
    m.includes("failed to get document because the client is offline")
  ) {
    return "Your connection was interrupted. Check your internet and try again.";
  }
  if (m.includes("unauthorized") || m.includes("unauthenticated")) {
    return "You need to be signed in to continue.";
  }
  if (m.includes("permission-denied") || m.includes("missing or insufficient permissions")) {
    return "You do not have permission to perform this action.";
  }
  if (m.includes("not-found")) {
    return "That record could not be found.";
  }
  if (
    m.includes("auth/") ||
    m.includes("firebase") ||
    m.includes("firestore") ||
    m.includes("permission-denied")
  ) {
    return "Something went wrong. Please try again.";
  }
  if (raw.includes("\n") || raw.length > 180) {
    return "Something went wrong. Please try again.";
  }
  return raw;
}

export function classifyFirebase(error: unknown): AppError {
  const raw = firebaseErrorText(error);
  const m = raw.toLowerCase();
  if (m.includes("auth/")) return new AppError("auth", mapFirebaseMessage(raw), error);
  if (m.includes("permission")) return new AppError("permission", mapFirebaseMessage(raw), error);
  if (m.includes("not-found") || m.includes("not_found")) {
    return new AppError("not_found", mapFirebaseMessage(raw), error);
  }
  if (m.includes("resource-exhausted") || m.includes("too-many")) {
    return new AppError("rate_limit", mapFirebaseMessage(raw), error);
  }
  if (m.includes("network") || m.includes("unavailable") || m.includes("failed to fetch")) {
    return new AppError("network", mapFirebaseMessage(raw), error);
  }
  return new AppError("unexpected", mapFirebaseMessage(raw), error);
}
