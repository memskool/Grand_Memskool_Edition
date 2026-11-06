import { isFreshLiveSession } from "./live-session-fresh";

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
