import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";

const ApplicationStatusSchema = z.enum(["pending", "under_review", "approved", "rejected"]);

export const listSchoolApplications = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { listSchoolApplicationsHandler } = await import("@/lib/applications.server");
    return listSchoolApplicationsHandler(context);
  });

export const reviewSchoolApplication = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.string().min(1),
        status: ApplicationStatusSchema,
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { reviewSchoolApplicationHandler } = await import("@/lib/applications.server");
    return reviewSchoolApplicationHandler(data, context);
  });
