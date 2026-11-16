// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * nf3 (Nitro's dependency tracer) stores packages that exist in several versions under
 * `node_modules/.nf3/<pkg>@<version>` and *symlinks* them into place. Vercel's packaging
 * does not carry those links/dot-dir into the deployed function, so Node hit ENOENT on
 * e.g. `@grpc/grpc-js` at runtime. Replace every link with a real dereferenced copy and
 * drop the store, so the uploaded function is plain directories only.
 */
function dereferenceTracedSymlinks(functionsDir: string): void {
  if (!fs.existsSync(functionsDir)) return;
  for (const fn of fs.readdirSync(functionsDir, { withFileTypes: true })) {
    if (!fn.isDirectory()) continue;
    const nodeModules = path.join(functionsDir, fn.name, "node_modules");
    if (!fs.existsSync(nodeModules)) continue;
    let replaced = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) {
          const target = fs.realpathSync(full);
          // Unlink the link/junction itself (never its target), then copy the real tree in.
          // Windows can report EPERM/ENOTEMPTY while a just-removed junction is still
          // pending deletion, so retry briefly instead of failing the whole build.
          for (let attempt = 1; ; attempt += 1) {
            try {
              fs.rmSync(full, { recursive: true, force: true });
              fs.cpSync(target, full, { recursive: true, dereference: true });
              break;
            } catch (error) {
              if (attempt >= 5) throw error;
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200 * attempt);
            }
          }
          replaced += 1;
        } else if (entry.isDirectory() && entry.name !== ".nf3") {
          walk(full);
        }
      }
    };
    walk(nodeModules);
    fs.rmSync(path.join(nodeModules, ".nf3"), { recursive: true, force: true });
    if (replaced) {
      console.log(
        `[memskool] dereferenced ${replaced} traced symlink(s) in ${fn.name}/node_modules`,
      );
    }
  }
}

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
  // Registered as a module so the hook is *added* to the Vercel preset's own `compiled`
  // hook. A top-level `hooks.compiled` in config would replace the preset's (which writes
  // .vc-config.json) and ship a broken function.
  modules: [
    {
      name: "memskool:dereference-traced-symlinks",
      setup(nitro: {
        options: { output: { dir: string } };
        hooks: { hook: (name: "compiled", fn: () => void | Promise<void>) => unknown };
      }) {
        nitro.hooks.hook("compiled", () => {
          dereferenceTracedSymlinks(path.join(nitro.options.output.dir, "functions"));
        });
      },
    },
  ],
};

export default defineConfig({
  nitro: NITRO_OPTIONS,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});
