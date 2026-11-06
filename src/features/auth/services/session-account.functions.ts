import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";

/** Authoritative account profile for gates — Admin SDK + email reclaim if Auth UID changed. */
export const loadMyAccount = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    try {
      const { resolveSessionAccount } = await import("./session-account.server");
      return await resolveSessionAccount({
        userId: context.userId,
        email: context.email,
      });
    } catch (error) {
      console.error("[loadMyAccount]", error);
      throw error;
    }
  });

/** School linked to this account (after reclaim / claim-by-email). */
export const loadMyManagedSchool = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    try {
      const { loadManagedSchool } = await import("./session-account.server");
      return await loadManagedSchool({
        userId: context.userId,
        email: context.email,
      });
    } catch (error) {
      console.error("[loadMyManagedSchool]", error);
      throw error;
    }
  });

/** Open the school this account already owns. Institutions cannot switch to another school. */
export const openManagedSchool = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ schoolId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { adoptManagedSchool } = await import("./session-account.server");
      return await adoptManagedSchool({
        userId: context.userId,
        email: context.email,
        schoolId: data.schoolId,
      });
    } catch (error) {
      console.error("[openManagedSchool]", error);
      if (error instanceof Error && error.message.length <= 160) throw error;
      throw new Error("Could not open that school for management.");
    }
  });
