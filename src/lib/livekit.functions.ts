import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import type { ClassroomToken } from "@/features/live-classroom/contracts";

export type { ClassroomToken };

/**
 * LiveKit token mint — Phase 6.
 * Auth + enrollment/Gold/suspension enforced in token.server via Admin authz
 * (same rules as joinLiveSession). Client chunks stay Admin-free via dynamic import.
 */
export const issueClassroomToken = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().min(1) }).parse(data))
  .handler(async (opts): Promise<ClassroomToken> => {
    const { issueClassroomTokenHandler } = await import("@/features/live-classroom/token.server");
    return issueClassroomTokenHandler(opts);
  });
