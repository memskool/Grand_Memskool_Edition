# Production readiness

Memskool after Phase 7 is a **production candidate**: critical client-write holes (orders, DMs, parent links, rewards) are closed in rules + matching app code, queries are bounded, secrets stay server-side, and the production build is expected to succeed.

It is **not** a certified release until:

1. A human deploys rules, indexes, and storage rules.
2. Production secrets and webhooks are set on the live host.
3. Backup/PITR is actually enabled (not only documented).
4. Real browser/device and E2E tests are run.

Phase 8 (release polish) may proceed after that deploy, not before treating the above as optional.
