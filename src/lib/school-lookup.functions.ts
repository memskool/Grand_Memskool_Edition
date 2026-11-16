import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { schoolCodeKey } from "@/lib/school-ids";

export type SchoolLookupResult = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
} | null;

/**
 * Public School-ID lookup. Reads only the directory collection (non-sensitive fields).
 * Uses Admin SDK so the client never needs a public Firestore query for tenancy data
 * beyond what Security Rules also allow on `school_directory`.
 */
export const lookupSchoolByCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(2).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<SchoolLookupResult> => {
    try {
      const { adminDb } = await import("@/lib/firebase/admin.server");
      const code = schoolCodeKey(data.code);
      const snap = await adminDb().collection("school_directory").doc(code).get();
      if (!snap.exists) return null;
      const row = snap.data();
      if (!row) return null;
      return {
        id: String(row["school_id"] ?? ""),
        name: String(row["name"] ?? ""),
        city: (row["city"] as string | null) ?? null,
        country: (row["country"] as string | null) ?? null,
      };
    } catch (error) {
      // Log the real cause: this RPC is the public health probe for the Admin SDK.
      console.error("[lookupSchoolByCode]", error);
      throw new Error(describeAdminFailure(error));
    }
  });

const GRPC_STATUS: Record<number, string> = {
  1: "CANCELLED",
  2: "UNKNOWN",
  3: "INVALID_ARGUMENT",
  4: "DEADLINE_EXCEEDED",
  5: "NOT_FOUND",
  7: "PERMISSION_DENIED",
  8: "RESOURCE_EXHAUSTED",
  9: "FAILED_PRECONDITION",
  13: "INTERNAL",
  14: "UNAVAILABLE",
  16: "UNAUTHENTICATED",
};

/**
 * Public, non-sensitive classification of an Admin SDK failure so operators can tell
 * *why* the server path is down without Vercel log access (see docs/DEPLOYMENT.md §8).
 * Only status names / error codes are exposed — never messages that could carry secrets.
 */
function describeAdminFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("missing Firebase admin credentials")) return message;
  const lower = message.toLowerCase();
  const base = "Could not verify that School ID right now";
  if (lower.includes("__dirname") || lower.includes("es module scope")) {
    return `${base} (server bundle error).`;
  }
  const code = (error as { code?: unknown } | null)?.code;
  const status =
    typeof code === "string"
      ? code
      : typeof code === "number"
        ? (GRPC_STATUS[code] ?? `grpc ${code}`)
        : lower.includes("credential") || lower.includes("private key")
          ? "credentials"
          : "unknown";
  // The runtime version matters: ERR_REQUIRE_ESM means Node < 22.12 (no require(esm)).
  // The first dependency frame names the module that failed to load (path only, no data).
  const frame = (error instanceof Error ? (error.stack ?? "") : "")
    .split(/\r?\n/)
    .map((line) => /node_modules[\\/](.+?):\d+/.exec(line)?.[1])
    .find((hit): hit is string => Boolean(hit));
  // Filesystem / module-resolution failures carry only a bundle path — surface it.
  const pathHint =
    status === "ENOENT" || status === "MODULE_NOT_FOUND" || status === "ERR_MODULE_NOT_FOUND"
      ? (/'([^']+)'/.exec(message)?.[1] ?? message.split(/\r?\n/)[0]?.slice(0, 160))
      : undefined;
  const details = [
    `node ${process.version}`,
    frame && `at ${frame}`,
    pathHint && `path ${pathHint}`,
  ]
    .filter(Boolean)
    .join("; ");
  return `${base} (${status}; ${details}).`;
}
