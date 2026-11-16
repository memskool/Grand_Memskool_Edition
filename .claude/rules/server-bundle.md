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
- `firebase-admin`, `@google-cloud/*`, `google-gax`, `@grpc/*`, `protobufjs`, `node-forge` must stay
  in `traceDeps`: inlined, they throw `__dirname is not defined in ES module scope` and every Admin SDK
  server function fails (writes then fall back to client Firestore writes that rules reject).
- `package.json` `sideEffects` must keep listing `src/lib/node-esm-globals.ts` and
  `src/lib/error-capture.ts`; `"sideEffects": false` lets the bundler drop those bare imports.
- `npm run build && npm run check:server-bundle` must pass before shipping server changes.
- Production health probe (no auth): `lookupSchoolByCode` with an unknown code returns `null` when the
  Admin SDK works, and "Could not verify that School ID right now." when it is broken.
