/**
 * Guard the Vercel server bundle against the regression that silently broke every
 * Admin SDK server function in production:
 *
 *   ReferenceError: __dirname is not defined in ES module scope
 *
 * Nitro 3 inlines dependencies into `_libs/` unless they are listed in `traceDeps`
 * (vite.config.ts). google-gax / grpc evaluate `path.join(__dirname, …)`, so the
 * Firebase Admin stack must stay in `node_modules` (loaded natively by Node), and the
 * `node-esm-globals` polyfill must survive tree-shaking (`sideEffects` in package.json).
 */
import fs from "node:fs";
import path from "node:path";

const funcDir = [".vercel/output/functions/__server.func", ".vercel/output/functions/__nitro.func"]
  .map((dir) => path.resolve(dir))
  .find((dir) => fs.existsSync(dir));

if (!funcDir) {
  console.error(
    "[check-server-bundle] No Vercel function output found. Run `npm run build` first.",
  );
  process.exit(1);
}

const failures = [];

// 1. The gRPC / google-gax stack must be traced into node_modules, never inlined into _libs.
const mustBeTraced = ["@google-cloud/firestore", "google-gax", "@grpc/grpc-js"];
for (const pkg of mustBeTraced) {
  if (!fs.existsSync(path.join(funcDir, "node_modules", pkg))) {
    failures.push(
      `${pkg} is missing from ${path.relative(process.cwd(), funcDir)}/node_modules (not traced)`,
    );
  }
}
const libsDir = path.join(funcDir, "_libs");
if (fs.existsSync(libsDir)) {
  const inlined = walk(libsDir).filter((file) =>
    /(^|[\\/])_libs[\\/](@google-cloud|google-gax|@grpc)/.test(file),
  );
  for (const file of inlined) {
    failures.push(`gRPC stack dependency inlined into bundle: ${path.relative(funcDir, file)}`);
  }
}

// 1b. Nothing in the traced tree may need a native require(esm): `jwks-rsa` (pulled by
//     firebase-admin) requires the ESM-only `jose` v6, which Vercel's runtime rejects with
//     ERR_REQUIRE_ESM. firebase-admin must therefore be bundled, not traced.
for (const pkg of ["firebase-admin", "jwks-rsa"]) {
  if (fs.existsSync(path.join(funcDir, "node_modules", pkg))) {
    failures.push(`${pkg} was traced into node_modules — it must be bundled (see vite.config.ts)`);
  }
}
const tracedJose = path.join(funcDir, "node_modules", "jose", "package.json");
if (fs.existsSync(tracedJose)) {
  const jose = JSON.parse(fs.readFileSync(tracedJose, "utf8"));
  if (jose.type === "module") {
    failures.push(`traced node_modules/jose@${jose.version} is ESM-only (native require(esm))`);
  }
}

// 2. The function runtime must support require(esm): the traced Admin SDK chain
//    require()s the ESM-only `jose` v6, which throws ERR_REQUIRE_ESM below Node 22.12.
const vcConfigPath = path.join(funcDir, ".vc-config.json");
try {
  const runtime = String(JSON.parse(fs.readFileSync(vcConfigPath, "utf8")).runtime ?? "");
  const major = Number(/^nodejs(\d+)\.x$/.exec(runtime)?.[1] ?? NaN);
  if (!(major >= 22)) {
    failures.push(`function runtime is "${runtime}" — must be nodejs22.x or newer (require(esm))`);
  }
} catch (error) {
  failures.push(`could not read ${path.relative(process.cwd(), vcConfigPath)}: ${String(error)}`);
}

// 3. The __dirname polyfill must be present in the server code.
const serverFiles = walk(funcDir).filter(
  (file) => /\.(mjs|js|cjs)$/.test(file) && !file.includes(`${path.sep}node_modules${path.sep}`),
);
const polyfilled = serverFiles.some((file) => fs.readFileSync(file, "utf8").includes("/var/task"));
if (!polyfilled) {
  failures.push(
    "node-esm-globals polyfill (/var/task) is absent — check `sideEffects` in package.json",
  );
}

if (failures.length) {
  console.error("[check-server-bundle] FAILED:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log(
  `[check-server-bundle] OK — gRPC stack traced into node_modules, firebase-admin bundled (no native require(esm)), runtime >= nodejs22.x, polyfill present (${path.relative(process.cwd(), funcDir)}).`,
);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
