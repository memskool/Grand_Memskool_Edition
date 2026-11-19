import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";

/** Notifies the other conversation members about a message the caller just sent. */
export const notifyMessageSent = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ message_id: z.string().min(1).max(128) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { notifyNewMessage } = await import("@/lib/messaging.server");
    return notifyNewMessage({ messageId: data.message_id, callerId: context.userId });
  });
