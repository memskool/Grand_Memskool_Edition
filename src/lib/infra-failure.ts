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
