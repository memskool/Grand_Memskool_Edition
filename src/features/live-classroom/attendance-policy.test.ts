import {
  liveAttendanceDocId,
  markFromParticipation,
  participationDurationMs,
} from "./attendance-policy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(liveAttendanceDocId("sess1", "stu1") === "live_sess1_stu1", "attendance doc id");

assert(markFromParticipation(undefined, 60) === "absent", "no row → absent");
assert(markFromParticipation({ connected_at: null }, 60) === "absent", "no connect → absent");

const short = {
  connected_at: "2026-01-01T10:00:00.000Z",
  duration_ms: 10_000,
  left_at: "2026-01-01T10:00:10.000Z",
};
assert(
  markFromParticipation(short, 60, "2026-01-01T10:00:10.000Z") === "absent",
  "under min → absent",
);

const long = {
  connected_at: "2026-01-01T10:00:00.000Z",
  duration_ms: 120_000,
  left_at: "2026-01-01T10:02:00.000Z",
};
assert(
  markFromParticipation(long, 60, "2026-01-01T10:02:00.000Z") === "present",
  "over min → present",
);

const open = {
  connected_at: "2026-01-01T10:00:00.000Z",
  last_connected_at: "2026-01-01T10:00:00.000Z",
  left_at: null,
  duration_ms: 0,
};
assert(
  participationDurationMs(open, "2026-01-01T10:01:30.000Z") === 90_000,
  "open participant accrues until end",
);

console.log("attendance-policy unit checks passed");
