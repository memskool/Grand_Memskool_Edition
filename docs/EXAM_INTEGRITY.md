# Examination integrity

This is a foundation, not a cheat-proof lockdown.

Implemented:

- Firebase auth + server start checks (school, enrollment, publish, window, attempt limit).
- Server-authoritative `ends_at` / `remaining_ms`.
- Persisted shuffle so refresh cannot shop for a new paper.
- Integrity events: started, resumed, visibility hidden/visible, save failed, submit attempted, auto-submit. Cap 40 events per attempt. Staff-only reads.
- Exam-mode hides `/ai-tutor` in the client shell for `test` and `exam` types. **Deterrent only.**

Not implemented and not claimed:

- Full-screen lock, remote proctoring, webcam, keystroke biometrics.
- Automatic fail on tab switch.
- Blocking a student because a visibility event fired.

Browser limitations: a student can open another device or browser. Events are contextual information for teachers, not a verdict.
