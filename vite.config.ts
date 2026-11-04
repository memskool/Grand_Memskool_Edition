// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { dirnameShimPlugin } from "./src/lib/vite-dirname-shim";

/** CJS packages that break when Nitro bundles them into ESM (bare `__dirname`). */
const SSR_EXTERNALS = [
  "firebase-admin",
  "firebase-admin/app",
  "firebase-admin/auth",
  "firebase-admin/firestore",
  "firebase-admin/storage",
  "firebase-admin/messaging",
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
  "livekit-server-sdk",
  "jose",
];

export default defineConfig({
  // memskool.com deploys on Vercel — pin so Cloudflare's worker bundle is not used.
  // Extra keys are forwarded to nitro/vite even though Lovable's TS surface is narrow.
  nitro: {
    preset: "vercel",
    // Keep admin SDK out of the ESM server bundle (Node CJS keeps __dirname).
    noExternals: false,
    externals: {
      external: SSR_EXTERNALS,
    },
  } as { preset: string },
  plugins: [dirnameShimPlugin()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    ssr: {
      external: SSR_EXTERNALS,
    },
    plugins: [dirnameShimPlugin()],
    build: {
      rollupOptions: {
        external: SSR_EXTERNALS,
      },
    },
  },
});
