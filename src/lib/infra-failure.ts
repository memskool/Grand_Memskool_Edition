import { AppError, classifyFirebase } from "./errors/app-error";

/**
 * Phase 3/10: client dual-write is allowed only when the *server path itself* is broken.
 * Authz/permission failures must never fall back to a weaker client write.
 */
export function isInfrastructureFailure(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (message.includes("__dirname") || message.includes("es module scope")) return true;
  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("function timeout")
  ) {
    return true;
  }
  if (
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("not allowed") ||
    message.includes("not approved")
  ) {
    return false;
  }
  return false;
}

function shortServerReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const first = message.split(/\r?\n/)[0]?.trim() ?? "";
  if (!first) return "";
  if (first.includes("__dirname") || first.toLowerCase().includes("es module scope")) {
    return "server runtime error";
  }
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
}

/**
 * Error for a client fallback write that failed *after* the server path was already down.
 * A rules denial here is almost never a real permission problem: the server (which heals
 * claims and writes with the Admin SDK) is unavailable and the stale token cannot satisfy
 * Security Rules. Say that, instead of a misleading "You do not have permission".
 */
export function fallbackWriteError(serverError: unknown, clientError: unknown): AppError {
  const classified = classifyFirebase(clientError);
  if (classified.code !== "permission") return classified;
  const reason = shortServerReason(serverError);
  return new AppError(
    "unexpected",
    `The server could not complete this action${reason ? ` (${reason})` : ""}, and your session is not allowed to save it directly. Refresh the page and try again; if it keeps happening, the server deployment needs attention.`,
    clientError,
  );
}
