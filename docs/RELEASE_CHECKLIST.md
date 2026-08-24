# Release checklist

Use this before inviting real schools. Unchecked items are still required for a full production declaration.

## Product

- [x] Visible core features are wired to Firebase or honest configuration errors (AI / LiveKit / payments).
- [x] No “coming soon” buttons found in `src/`.
- [x] Student / teacher / school-admin journeys exist end-to-end in code.
- [x] Parent journey: Families admin UI + linked reads (deploy rules before relying on this).
- [x] Superadmin: school names only; no fake private-data browser.
- [x] Empty, loading, and error states on major screens.
- [x] Public landing, privacy, and terms pages.
- [ ] Live E2E of every role on a clean browser (human / QA).

## Security

- [x] Auth + custom claims model in code.
- [x] School isolation in rules (tenant + linked parent).
- [x] Client cannot create paid orders; rewards client-write denied.
- [x] Parent self-link denied; admin `linkParentStudent` uses deterministic ids.
- [x] AI / LiveKit / Flutterwave secrets are server env, not `VITE_`.
- [x] Assessment keys and private results Admin-only.
- [ ] Firestore + Storage rules **deployed** to `memskool-4e193`.
- [ ] Authorized domains + webhooks on the live host.
- [ ] Production red-team / emulator rules tests.

## Quality

- [x] `npx tsc --noEmit`
- [x] Lint of Phase 8 sources
- [x] Production `npm run build`
- [x] Unit checks: marking, error mapping, parent-link id
- [ ] Device lab (phone / tablet / desktop)
- [ ] Browser matrix (see `docs/BROWSER_COMPATIBILITY.md`)

## Performance

- [x] School-scoped listeners and list limits from Phase 7 remain.
- [x] New family-link queries are school-scoped.
- [ ] No production performance budget measured on the live host.

## Operations

- [ ] Production `.env` / host secrets set
- [x] Analytics catalog (`docs/ANALYTICS_AND_EVENTS.md`) — fires only if measurement ID is set
- [x] Observability described (`docs/OBSERVABILITY.md`)
- [ ] Backups / PITR enabled (`docs/BACKUP_AND_RECOVERY.md`)
- [x] Support runbook (`docs/SUPPORT_RUNBOOK.md`)

## Legal / privacy

- [x] `/privacy` and `/terms` describe the real stack (Firebase, Crane5, LiveKit, Flutterwave, analytics)
- [ ] Counsel review if required for your jurisdiction
- [x] No third-party curriculum dumped into the repo as if it were licensed content

## Final approval

- [x] No known **code** blocker for a supervised beta after rules deploy + secrets
- [ ] No known critical security hole **on the live project** (confirm rules are the Phase 8 file)
- [x] Remaining limitations documented in `docs/PHASE_8_COMPLETION_REPORT.md`
