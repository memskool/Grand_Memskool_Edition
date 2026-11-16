// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * CJS packages that crash when Nitro inlines them into the ESM server bundle
 * (google-gax / grpc evaluate `path.join(__dirname, …)` → "__dirname is not
 * defined in ES module scope", which took down every Admin SDK server function
 * on Vercel). Nitro 3 bundles *all* dependencies into `_libs/` by default and
 * ignores `vite.ssr.external`; `traceDeps` is the option that keeps a package in
 * `node_modules` so Node loads it natively. `scripts/check-server-bundle.mjs`
 * fails CI if these ever get inlined again.
 */
// `firebase-admin` itself is deliberately NOT traced: its CJS requires `jwks-rsa`, which
// requires the ESM-only `jose` v6 — a native require(esm) that Vercel's Node runtime
// rejects with ERR_REQUIRE_ESM. Bundled by rolldown instead, that edge becomes a plain
// ESM import and firebase-admin still reaches the traced Google stack through externals.
const ADMIN_SDK_TRACE_DEPS = [
  "@google-cloud/firestore",
  "@google-cloud/storage",
  "google-gax",
  "google-auth-library",
  "gcp-metadata",
  "gtoken",
  "@grpc/grpc-js",
  "@grpc/proto-loader",
  "protobufjs",
  "node-forge",
];

// memskool.com deploys on Vercel — pin so Cloudflare's worker bundle is not used.
// Declared as a variable (not an inline literal) because @lovable.dev/vite-tanstack-config
// types only a subset of Nitro options; the full object is still passed through to Nitro.
const NITRO_OPTIONS = {
  preset: "vercel",
  traceDeps: ADMIN_SDK_TRACE_DEPS,
  vercel: {
    functions: {
      // Nitro otherwise copies the *build machine's* Node major into .vc-config.json.
      // The traced Admin SDK chain require()s the ESM-only `jose` v6 (via gtoken), which
      // needs require(esm) — Node ≥ 22.12. Pin the runtime so a Vercel project set to an
      // older Node cannot silently reintroduce ERR_REQUIRE_ESM on every server function.
      runtime: "nodejs22.x",
    },
  },
};

export default defineConfig({
  nitro: NITRO_OPTIONS,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});
