import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";

const optionalText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
});

const optionalMoney = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

const RegisterSchoolSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(40),
  city: optionalText,
  country: z.string().trim().min(1).max(80),
  website: optionalText,
  description: optionalText,
  fees_min: optionalMoney,
  fees_max: optionalMoney,
  badges: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  is_international: z.boolean().default(false),
  admissions_open: z.boolean().optional(),
});

export const registerDigitalSchool = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = RegisterSchoolSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(issue?.message ?? "Check the school details and try again.");
    }
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { registerDigitalSchoolHandler } = await import("@/lib/school-register.server");
    return registerDigitalSchoolHandler(data, context);
  });

export const listDirectorySchools = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    const { listDirectorySchoolsHandler } = await import("@/lib/school-register.server");
    return listDirectorySchoolsHandler(context);
  });

export const deleteDigitalSchool = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ schoolId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteDigitalSchoolHandler } = await import("@/lib/school-register.server");
    return deleteDigitalSchoolHandler(data, context);
  });
