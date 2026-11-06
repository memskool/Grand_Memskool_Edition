# Live UI QA checklist (Phase 9)

Use against `ClassroomRoom` and `GoldLiveRoom` before shipping live UI changes.

## Contrast

- [ ] Mic / cam / share / leave dock buttons readable on light theme (ink fill, not pale grey-on-white).
- [ ] “On” state (leaf) distinguishable from default ink.
- [ ] Soft/header actions still have a visible border against `bg-background`.
- [ ] Stage “Waiting for the teacher” copy readable on dark stage (`text-ink-muted` on `bg-ink`).

## Layout

- [ ] First viewport on mobile: stage + dock without clipped controls.
- [ ] Chat / people drawer does not cover dock on small screens.
- [ ] Screen share tile appears without collapsing local tile entirely.

## Behaviour

- [ ] Host Leave ends LIVE for students.
- [ ] Pending teacher cannot open `/virtual-classroom` via URL.
- [ ] Gold room: chat + End for host; Leave for learner.
