/**
 * Phase 3: fail CI if firebase-admin (or Admin SDK entry paths) appear in client bundles.
 */
import fs from "node:fs";
import path from "node:path";

const roots = [".output/public", "dist/client", "dist", ".vercel/output/static"].filter((dir) =>
  fs.existsSync(dir),
);

if (roots.length === 0) {
  console.error(
    "[check-no-admin-in-client] No client build output found (.output/public, dist, …). Run build first.",
  );
  process.exit(1);
}

const banned = [
  "firebase-admin",
  "firebase-admin/app",
  "firebase-admin/auth",
  "firebase-admin/firestore",
  "firebase-admin/storage",
  "firebase-admin/messaging",
];

const hits = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(js|mjs|cjs|map|html)$/i.test(entry.name)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const needle of banned) {
      if (text.includes(needle)) {
        hits.push(`${full} contains ${needle}`);
      }
    }
  }
}

for (const root of roots) walk(root);

if (hits.length) {
  console.error("[check-no-admin-in-client] firebase-admin leaked into client bundles:");
  for (const hit of hits.slice(0, 40)) console.error(`  - ${hit}`);
  if (hits.length > 40) console.error(`  …and ${hits.length - 40} more`);
  process.exit(1);
}

console.log(
  `[check-no-admin-in-client] OK — scanned ${roots.join(", ")} with no firebase-admin references.`,
);
