import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { resolveSessionAccount } from "@/features/auth/services/session-account.server";

/** Authoritative account profile for gates — Admin SDK + email reclaim if Auth UID changed. */
export const loadMyAccount = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    try {
      return await resolveSessionAccount({
        userId: context.userId,
        email: context.email,
      });
    } catch (error) {
      console.error("[loadMyAccount]", error);
      return null;
    }
  });
