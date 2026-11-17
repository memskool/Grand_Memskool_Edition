/** Retry schedule for realtime listeners (pure; no Firebase imports so it is unit-testable). */
export const LIVE_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000] as const;

export function backoffDelayMs(attempt: number): number {
  const index = Math.max(0, Math.min(attempt, LIVE_BACKOFF_MS.length - 1));
  return LIVE_BACKOFF_MS[index] ?? 30_000;
}

export function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return code === "permission-denied" || message.includes("insufficient permissions");
}
