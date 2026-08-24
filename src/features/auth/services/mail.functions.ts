import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";

export const sendVerificationEmail = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ origin: z.string().url().max(500) }).parse(data))
  .handler(async (opts) => {
    const { sendVerificationEmailHandler } = await import("./mail.server");
    return sendVerificationEmailHandler(opts);
  });

export const sendPasswordResetMail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().email().max(254), origin: z.string().url().max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { sendPasswordResetMailHandler } = await import("./mail.server");
    return sendPasswordResetMailHandler({ data });
  });
