# Final production audit

**Date:** 2026-08-24  
**Lens:** Launch as a real school workspace, with LiveKit (not Daily.co), Crane5 and Flutterwave keys added later.

Severity: **BLOCKER** = cannot operate even a closed beta. **CRITICAL** = security or core integrity. **HIGH** = serious product gap. Lower = polish or human ops.

## BLOCKER

| ID | Finding | Status |
| --- | --- | --- |
| B1 | Fake checkout or fake tutor answers | **Resolved in code.** Checkout and tutor refuse when secrets are missing. UI shows a service notice and disables the action. |
| B2 | No Firebase Admin on the host | **Human.** Without `FIREBASE_SERVICE_ACCOUNT_JSON` as JSON on Vercel (or equivalent), signup/claims/grading fail. Not fakeable from the repo. |
| B3 | Firestore/Storage rules not deployed to the live project | **Human.** Repository rules are reviewed; Console must match. |

No remaining in-repo BLOCKER that can be coded around without production credentials.

## CRITICAL

| ID | Finding | Status |
| --- | --- | --- |
| C1 | Tenant isolation relies on claims + rules | **In code.** School A admin must not read school B. Requires rules **deployed**. |
| C2 | Answer keys client-readable | **Mitigated.** `assessment_answer_keys` is Admin-only in rules. |
| C3 | Payment success trusted in the browser | **Mitigated.** Orders update after server verify/webhook. Checkout is off until Flutterwave secret exists. |
| C4 | AI credentials in the client | **Mitigated.** Crane5 key is server-only. |
| C5 | Unrestricted live room URLs | **Mitigated.** Short-lived LiveKit JWTs from `issueClassroomToken`. |
| C6 | Privacy/terms missing | **Mitigated.** `/privacy`, `/terms` exist as product notices, not legal certification. |

## HIGH

| ID | Finding | Status |
| --- | --- | --- |
| H1 | Crane5 / Flutterwave unset | **Expected.** Honest unavailable state. |
| H2 | Spark blocks Functions | **Documented.** In-app notifications still write; FCM trigger fan-out is not live. |
| H3 | Parent access without Families link | **By design.** Admin must link. |
| H4 | No E2E suite | **Documented.** CI is typecheck/lint/unit/build. |
| H5 | Host env drift vs local `.env` | **Human.** Especially Admin JSON path vs JSON string. |

## MEDIUM

| ID | Finding | Status |
| --- | --- | --- |
| M1 | App Check not enforced | Optional until site key + debug tokens are ready. |
| M2 | CSP not fully set on host | Host configuration. |
| M3 | Insight refresh uses Lovable gateway | Gated; not presented as Crane5. |
| M4 | robots.txt incomplete vs every private path | Authenticated layout already `noindex`. |

## LOW / POLISH

| ID | Finding | Status |
| --- | --- | --- |
| P1 | Empty states / loading / errors | Present on major academic screens; capabilities notices added for tutor, payments, live video, insights. |
| P2 | Superadmin is directory-only | Intentional. |
| P3 | Landing copy mentions tutor “when Crane5 is connected” | Honest. |

## Fake / incomplete UI sweep

Searched `src/` for `TODO`, `FIXME`, `coming soon`, `not yet implemented`. No product TODOs. Form `placeholder` attributes are legitimate input hints.

Buttons that look like they work:

- **Buy / Book** — disabled until Flutterwave is configured.
- **Ask AI / Send** — navigates to tutor; send is disabled until Crane5 is configured.
- **Start / Join live** — disabled until LiveKit is configured on the server.
- **Refresh insights** — disabled until `LOVABLE_API_KEY` is set.

## Recommendation

**READY FOR BETA / LIMITED RELEASE** after humans deploy rules/indexes and set host Firebase Admin + Resend + (optionally) LiveKit.

**Not READY FOR PRODUCTION** until live E2E on the production origin, Flutterwave sandbox proof if charging money, Crane5 proof if advertising the tutor, backups/PITR, and store listings if shipping a native wrapper.
