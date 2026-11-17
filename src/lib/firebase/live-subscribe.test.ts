import { backoffDelayMs, isPermissionDenied, LIVE_BACKOFF_MS } from "./live-backoff";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(backoffDelayMs(0) === 1_000, "first retry is fast (1s) so a just-joined student sees chat");
assert(backoffDelayMs(2) === 4_000, "backoff grows");
assert(backoffDelayMs(99) === LIVE_BACKOFF_MS[LIVE_BACKOFF_MS.length - 1], "capped at 30s");
assert(backoffDelayMs(-5) === 1_000, "negative attempts clamp to the first delay");
assert(
  isPermissionDenied(Object.assign(new Error("x"), { code: "permission-denied" })),
  "firestore code is recognised",
);
assert(
  isPermissionDenied(new Error("FirebaseError: Missing or insufficient permissions.")),
  "message form is recognised",
);
assert(!isPermissionDenied(new Error("unavailable")), "other errors are not permission denials");

console.log("live-subscribe unit checks passed");
