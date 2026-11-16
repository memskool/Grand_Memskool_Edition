---
paths:
  - "vite.config.ts"
  - "package.json"
  - "scripts/check-server-bundle.mjs"
  - "src/lib/node-esm-globals.ts"
---

# Vercel server bundle (Nitro 3)

- Nitro 3 inlines **every** dependency into `_libs/` unless it is listed in `nitro.traceDeps`
  (`vite.config.ts`). `vite.ssr.external` is **ignored** by Nitro — do not rely on it.
- `@google-cloud/*`, `google-gax`, `@grpc/*`, `protobufjs`, `node-forge` must stay in `traceDeps`:
  inlined, they throw `__dirname is not defined in ES module scope` and every Admin SDK server
  function fails (writes then fall back to client Firestore writes that rules reject).
- `firebase-admin` itself must stay **bundled** (not in `traceDeps`): its `jwks-rsa` requires the
  ESM-only `jose` v6, and that native `require(esm)` fails on Vercel with `ERR_REQUIRE_ESM`.
- `package.json` `sideEffects` must keep listing `src/lib/node-esm-globals.ts` and
  `src/lib/error-capture.ts`; `"sideEffects": false` lets the bundler drop those bare imports.
- The Vercel function runtime is pinned to `nodejs22.x` (`nitro.vercel.functions.runtime`).
- nf3 symlinks multi-version packages into `node_modules/.nf3/`; Vercel drops those links (ENOENT at
  runtime). The `compiled` hook in `vite.config.ts` replaces them with real copies — keep it.
- `npm run build && npm run check:server-bundle` must pass before shipping server changes.
- Production health probe (no auth): `lookupSchoolByCode` with an unknown code returns `null` when the
  Admin SDK works, and "Could not verify that School ID right now." when it is broken.
