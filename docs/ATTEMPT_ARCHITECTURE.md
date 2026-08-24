# Attempt architecture

`startAssessmentAttempt` is the only way to open a paper.

Checks: student role, same school, published (not draft/closed), availability window, active enrollment, attempt limit.

If an `in_progress` attempt exists, it is **resumed** (same `question_order`, `option_order`, `started_at`, `ends_at`, saved answers). Refresh does not reshuffle or reset the clock.

New attempts persist shuffle order. `max_attempts` 0 = unlimited (practice default).

## Timing

Server writes `started_at` and `ends_at` (null for practice / 0 minutes). `getAttemptClock` returns `remaining_ms` from server time. The client displays remaining from the last clock sample. Submit and save enforce `ends_at` on the server (60s grace for late autosave). Device clock changes cannot extend official time.

## Answers

`saveAttemptAnswers` (in_progress only) is called on a 2.5s debounce. Last write wins. Save state: Saving / Saved / Save failed.

## Offline policy

- Practice: more tolerant; answers retry on reconnect via the same save function.
- Timed test/exam: clock and submit stay server-authoritative. Offline save may fail; integrity event `save_failed` is recorded. There is no offline submit and no local score.

This is recovery, not a cheat-proof offline exam.
