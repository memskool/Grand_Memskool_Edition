# Deprecated client dual-paths

**Status:** retained for infra-only recovery until monitoring gate passes.

Do **not** add new client fallbacks. Prefer fixing the server path.

| Module | Hooks / functions | Remove after |
|--------|-------------------|--------------|
| `src/lib/classroom-data.ts` | start / end / cancel / join / leave / presence | `client_fallback` ≈ 0 × 14d |
| `src/features/academic/academic-data.ts` | enrol student / assign teacher | same |

Related: `docs/qa/CLIENT_FALLBACK_MONITORING.md`.
