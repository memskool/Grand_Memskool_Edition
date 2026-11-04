/**
 * Nitro/Vite ESM bundles CJS libraries (firebase-admin, google-auth) that still
 * read __dirname. Workers and `"type": "module"` Node do not define it.
 */
const g = globalThis as typeof globalThis & { __dirname?: string; __filename?: string };
if (typeof g.__dirname === "undefined") g.__dirname = "/var/task";
if (typeof g.__filename === "undefined") g.__filename = "/var/task/index.js";
