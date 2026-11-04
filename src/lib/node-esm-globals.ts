/**
 * Safety net for any leftover bare `__dirname` / `__filename` access.
 * Prefer the Vite dirname shim (rewrites to import.meta.*) and Nitro externals.
 * Node 22+ provides import.meta.dirname / import.meta.filename.
 */
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const g = globalThis as typeof globalThis & {
  __dirname?: string;
  __filename?: string;
  require?: NodeRequire;
};

const filename =
  typeof import.meta.filename === "string" ? import.meta.filename : fileURLToPath(import.meta.url);
const dir = typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(filename);

if (typeof g.__dirname === "undefined") g.__dirname = dir || "/var/task";
if (typeof g.__filename === "undefined") g.__filename = filename || "/var/task/index.js";
if (typeof g.require === "undefined") {
  try {
    g.require = createRequire(import.meta.url);
  } catch {
    // Workers without filesystem still run the rest of the app.
  }
}
