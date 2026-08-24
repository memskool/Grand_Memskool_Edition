# Phase 7 completion report

**Date:** 2026-08-22  
**Project:** `memskool-4e193`  
**Mandate:** Production hardening. Phase 8 not started.

## 1. Major problems discovered

World-readable DMs; client-created paid orders; parent self-linking; student self-awarded points; unbounded user scan and whole-collection timetable listener; marketplace not school-scoped; unreleased Flutterwave return not reconciled; raw error strings; robots allowing app paths.

## 2–3. Security fixes

See `docs/SECURITY_HARDENING.md`. Orders, messaging membership, parent links, rewards, marketplace tenancy, locker field locks, submission status enum, storage MIME/size, flush throttle, noindex.

## 4–5. Performance / cost

School-scoped timetable listener; overview `limit(400)` + counts; chat last 80; marketplace/orders/assessments capped. Flush lock 15s.

## 6–7. Mobile / a11y

No device lab. Shell already has skip-link, `main`, mobile nav, exam timer a11y. Residual: charts, LiveKit tiles, some icon buttons.

## 8–10. AI / classroom / assessment

AI still server-gateway + school-checked context (no change required for prompt-injection privilege). Classroom sessions remain Admin-tokened. Assessment keys/private scores remain Admin-only; no extra client mark path found.

## 11. Payments

Webhook verify + amount check already existed. Client order create closed. `reconcileOrder` wired on `?ref=` / `tx_ref`. Cross-school item IDs rejected.

## 12. Tests run

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| ESLint on Phase 7 sources | Passed |
| Marking + error-mapping unit checks | Passed |
| `npm run build` | Passed |
| Firestore + Storage rules syntax | No errors |

**Not run:** emulator rules tests, E2E journeys, browser matrix, device lab, production red-team.

## 13. Browsers / devices

Engineering review only (Chrome/Edge/Firefox/Safari intent). See `docs/BROWSER_COMPATIBILITY.md`.

## 14. Remaining issues

Old DM threads without `member_ids` may be unreadable to non-creators until a new conversation is started. Backups/PITR not enabled. App Check not enforced. Spark still blocks Cloud Functions. Dual client/server academic writes remain. Unused Supabase/LiveKit-component packages kept (Lovable/scaffold). CSP not applied.

## 15. Human configuration

1. `firebase deploy --only firestore:rules,firestore:indexes,storage`
2. Host secrets: Admin JSON, Crane5, LiveKit, Flutterwave
3. Auth authorized domains + webhooks
4. Enable Firestore PITR/export if required
5. Blaze only if Functions/App Hosting are needed

## 16. Ready for Phase 8?

**Yes, as a production candidate after the rules/storage deploy above.** Not a certified public launch. Do not skip the human deploy.
