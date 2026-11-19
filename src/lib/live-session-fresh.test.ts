import {
  HOST_RECONNECT_GRACE_MS,
  hostGraceRemainingMs,
  hostPresence,
  isFreshLiveSession,
} from "./live-session-fresh";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const now = Date.parse("2026-06-01T12:00:00.000Z");

assert(
  isFreshLiveSession(
    { is_active: true, status: "live", started_at: "2026-06-01T11:00:00.000Z" },
    now,
  ),
  "fresh active live",
);

assert(
  !isFreshLiveSession(
    { is_active: false, status: "live", started_at: "2026-06-01T11:00:00.000Z" },
    now,
  ),
  "inactive not live",
);

assert(
  !isFreshLiveSession(
    { is_active: true, status: "ended", started_at: "2026-06-01T11:00:00.000Z" },
    now,
  ),
  "ended status not live",
);

assert(
  !isFreshLiveSession(
    { is_active: true, status: "live", started_at: "2026-06-01T07:00:00.000Z" },
    now,
  ),
  "stale >4h not live",
);

assert(
  !isFreshLiveSession({ is_active: true, status: "live", started_at: "not-a-date" }, now),
  "bad started_at not live",
);

console.log("live-session-fresh unit checks passed");

// Host reconnect grace (Phase 3).
assert(hostPresence({ left_at: null }, now) === "present", "host in room is present");
assert(hostPresence(null, now) === "gone", "missing host row is gone");
assert(
  hostPresence({ left_at: new Date(now - 30_000).toISOString() }, now) === "grace",
  "host dropped 30s ago is in grace",
);
assert(
  hostPresence({ left_at: new Date(now - HOST_RECONNECT_GRACE_MS - 1).toISOString() }, now) ===
    "gone",
  "host dropped past the grace is gone",
);
assert(hostPresence({ left_at: "not-a-date" }, now) === "gone", "bad timestamp is gone");
assert(
  hostGraceRemainingMs({ left_at: new Date(now - 60_000).toISOString() }, now) ===
    HOST_RECONNECT_GRACE_MS - 60_000,
  "grace remaining counts down",
);
assert(hostGraceRemainingMs({ left_at: null }, now) === 0, "no grace while present");
