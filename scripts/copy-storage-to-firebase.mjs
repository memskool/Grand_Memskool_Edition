#!/usr/bin/env node
/**
 * Move files from Supabase Storage back to Firebase Storage (after Blaze is on).
 *
 * Paths are identical under both providers, so this is a straight copy. Run it, check
 * the summary, then set STORAGE_PROVIDER=firebase on Vercel and redeploy.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   GOOGLE_APPLICATION_CREDENTIALS=./path/to/firebase-adminsdk.json \
 *   FIREBASE_STORAGE_BUCKET=memskool-4e193.firebasestorage.app \
 *   node scripts/copy-storage-to-firebase.mjs [--dry-run] [--force]
 *
 * Buckets copied: SUPABASE_STORAGE_BUCKET (default "memskool") and SUPABASE_PUBLIC_BUCKET
 * (default "memskool-public", avatars). Existing Firebase objects are skipped unless --force.
 * Note: Supabase avatar URLs already saved on profiles keep pointing at Supabase until each
 * person uploads a new photo, so keep the Supabase project until you no longer need them.
 */
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const FORCE = args.has("--force");

const SB_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FB_BUCKET = process.env.FIREBASE_STORAGE_BUCKET;
if (!SB_URL || !SB_KEY || !FB_BUCKET) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FIREBASE_STORAGE_BUCKET.");
  process.exit(1);
}
const BUCKETS = [
  process.env.SUPABASE_STORAGE_BUCKET || "memskool",
  process.env.SUPABASE_PUBLIC_BUCKET || "memskool-public",
];

const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  : applicationDefault();
initializeApp({ credential, storageBucket: FB_BUCKET });
const fb = getStorage().bucket();

const headers = { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY };
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

async function list(bucket, prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SB_URL}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix} → ${res.status}`);
    const page = await res.json();
    for (const item of page) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null)
        out.push(...(await list(bucket, full))); // folder
      else out.push(full);
    }
    if (page.length < 1000) break;
  }
  return out;
}

let copied = 0;
let skipped = 0;
let failed = 0;
for (const bucket of BUCKETS) {
  let paths = [];
  try {
    paths = await list(bucket, "");
  } catch (error) {
    console.warn(`Skipping bucket ${bucket}: ${error.message}`);
    continue;
  }
  console.log(`${bucket}: ${paths.length} object(s)`);
  for (const path of paths) {
    try {
      const target = fb.file(path);
      if (!FORCE && (await target.exists())[0]) {
        skipped += 1;
        continue;
      }
      if (DRY) {
        console.log(`  would copy ${path}`);
        copied += 1;
        continue;
      }
      const res = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${enc(path)}`, { headers });
      if (!res.ok) throw new Error(`download → ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await target.save(buf, {
        contentType: res.headers.get("content-type") || "application/octet-stream",
        resumable: false,
      });
      copied += 1;
      console.log(`  copied ${path}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAILED ${path}: ${error.message}`);
    }
  }
}
console.log(
  `\nDone. ${DRY ? "Would copy" : "Copied"} ${copied}, skipped ${skipped}, failed ${failed}.`,
);
process.exit(failed ? 1 : 0);
