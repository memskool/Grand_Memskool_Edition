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

/**
 * How long a class stays open after the host's connection drops (network blip, phone
 * switching networks, closed tab). The host's own Leave / End still ends it at once.
 */
export const HOST_RECONNECT_GRACE_MS = 3 * 60 * 1000;

export type HostPresence = "present" | "grace" | "gone";

/**
 * Host presence from their participant row: in the room, inside the reconnect grace,
 * or gone. A missing row is "gone" (the host never joined or the row was removed).
 */
export function hostPresence(
  host: { left_at?: string | null } | null | undefined,
  now = Date.now(),
): HostPresence {
  if (!host) return "gone";
  if (!host.left_at) return "present";
  const left = Date.parse(host.left_at);
  if (Number.isNaN(left)) return "gone";
  return now - left <= HOST_RECONNECT_GRACE_MS ? "grace" : "gone";
}

/** Milliseconds left in the host's reconnect grace (0 when present-or-gone is settled). */
export function hostGraceRemainingMs(
  host: { left_at?: string | null } | null | undefined,
  now = Date.now(),
): number {
  if (!host?.left_at) return 0;
  const left = Date.parse(host.left_at);
  if (Number.isNaN(left)) return 0;
  return Math.max(0, HOST_RECONNECT_GRACE_MS - (now - left));
}
