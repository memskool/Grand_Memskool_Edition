import type { Plugin } from "vite";

/**
 * Nitro may bundle CJS packages into ESM chunks. Bare `__dirname` / `__filename`
 * then throw ReferenceError. Rewrite those identifiers to Node 22+ `import.meta.*`.
 */
function rewriteDirnameIdents(code: string): string {
  return code
    .replace(/(^|[^\w.$])__dirname\b/g, "$1import.meta.dirname")
    .replace(/(^|[^\w.$])__filename\b/g, "$1import.meta.filename");
}

export function dirnameShimPlugin(): Plugin {
  return {
    name: "memskool:dirname-shim",
    enforce: "pre",
    transform(code, id) {
      if (!code.includes("__dirname") && !code.includes("__filename")) return null;
      if (id.includes("node-esm-globals") || id.includes("vite-dirname-shim")) return null;
      if (!id.includes("node_modules") && !id.includes("\0")) return null;
      const next = rewriteDirnameIdents(code);
      if (next === code) return null;
      return { code: next, map: null };
    },
    renderChunk(code, _chunk, opts) {
      if (opts.format !== "es") return null;
      if (!code.includes("__dirname") && !code.includes("__filename")) return null;
      const next = rewriteDirnameIdents(code);
      if (next === code) return null;
      return { code: next, map: null };
    },
  };
}
