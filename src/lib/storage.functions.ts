import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { authorizeStorage } from "@/lib/storage-policy";

const PathSchema = z.string().trim().min(1).max(512);

function actorOf(context: { userId: string; role: string; schoolId: string | null }) {
  return { userId: context.userId, role: context.role, schoolId: context.schoolId };
}

/** Authorizes an upload and returns where to send the bytes (provider-neutral). */
export const prepareUpload = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        path: PathSchema,
        size: z
          .number()
          .int()
          .min(1)
          .max(200 * 1024 * 1024),
        contentType: z.string().trim().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const decision = authorizeStorage(actorOf(context), data.path, "write", {
      size: data.size,
      contentType: data.contentType || "application/octet-stream",
    });
    if (!decision.ok) throw new Error(decision.reason);
    const { createUploadTarget } = await import("@/lib/storage-provider.server");
    return createUploadTarget(data.path);
  });

/** Authorizes a read and returns a short-lived link (provider-neutral). */
export const getStoredFileUrl = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ path: PathSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const decision = authorizeStorage(actorOf(context), data.path, "read");
    if (!decision.ok) throw new Error(decision.reason);
    const { createReadUrl } = await import("@/lib/storage-provider.server");
    const url = await createReadUrl(data.path);
    if (!url) throw new Error("That file could not be found.");
    return { url };
  });

export const deleteStoredFile = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ path: PathSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const decision = authorizeStorage(actorOf(context), data.path, "delete");
    if (!decision.ok) throw new Error(decision.reason);
    const { deleteObject } = await import("@/lib/storage-provider.server");
    await deleteObject(data.path);
    return { ok: true as const };
  });
