/** Ghost LIVE badges: teachers leave without End, leaving is_active forever. */
export const LIVE_SESSION_MAX_MS = 4 * 60 * 60 * 1000;

export function isFreshLiveSession(
  session: { is_active: boolean; status?: string | null; started_at: string },
  now = Date.now(),
): boolean {
  if (!session.is_active) return false;
  const status = session.status ?? "live";
  if (status !== "live") return false;
  const started = Date.parse(session.started_at);
  if (Number.isNaN(started)) return false;
  return now - started <= LIVE_SESSION_MAX_MS;
}
