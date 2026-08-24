# Testing

## Automated (CI)

`.github/workflows/ci.yml` runs on `main` and pull requests:

| Check | Command |
| --- | --- |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit checks | `npm test` |
| Production build | `npm run build` (CI copies `.env.example`) |

Unit files (assert scripts, not a full runner):

- `src/lib/parent-link.test.ts` — parent link document ids
- `src/lib/errors/app-error.test.ts` — no raw Firebase leaks
- `src/features/assessment/marking.test.ts` — auto-marking

There is **no** Playwright/Cypress suite in this repository.

## Rules

```bash
firebase deploy --only firestore:rules,storage --dry-run
```

A dedicated emulator rules test harness is not in CI.

## Journeys to run by hand before a beta cohort

Use two browsers (or profiles): student and teacher/admin of the **same** school. Use a third for another school to prove isolation.

### Student

Create account → onboarding → School ID or Dream School apply → wait for approval → open class → open published lesson → save to locker → (if Crane5) ask tutor → (if LiveKit) join live class → submit assignment → take assessment → see released result.

### Teacher

Approved teacher → dashboard → create/publish lesson → create assignment → review submission → create/publish assessment → start live class → end class.

### School

Register school → School Admin setup → invite/approve teacher → manage applications → create class → enrol student → Families link for a parent.

### Parent

After Families link: see attendance and **released** results only. Changing the URL must not open another child.

### Negative

- Student of school A cannot read school B lessons.
- Student cannot approve their own application.
- Student cannot start a live session.
- Checkout without Flutterwave stays paused.
- Tutor without Crane5 stays paused.
- Suspended student cannot join live class or pay.

## What this pass did not run

- Clean-browser E2E on production
- Device lab (small phone / tablet / desktop)
- Slow-network lab
- Flutterwave sandbox payment
- Crane5 live prompt
- Play Store / TestFlight install
