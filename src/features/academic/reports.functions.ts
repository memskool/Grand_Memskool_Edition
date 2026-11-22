import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";

const PeriodId = z.string().min(1).max(128).nullable().default(null);

export const getClassGradebook = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ class_id: z.string().min(1).max(128), period_id: PeriodId }).parse(data),
  )
  .handler(async (opts) => {
    const { classGradebookHandler } = await import("./reports.server");
    return classGradebookHandler(opts);
  });

export const getStudentReportCard = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ student_id: z.string().min(1).max(128), period_id: PeriodId }).parse(data),
  )
  .handler(async (opts) => {
    const { studentReportCardHandler } = await import("./reports.server");
    return studentReportCardHandler(opts);
  });

export const listMyChildrenForReports = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async (opts) => {
    const { myChildrenForReportsHandler } = await import("./reports.server");
    return myChildrenForReportsHandler(opts);
  });

const ImportRowSchema = z.object({
  line: z.number().int().min(1),
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320).nullable(),
  class_name: z.string().trim().max(80).nullable(),
  child: z.string().trim().toLowerCase().max(320).nullable(),
});

export const bulkImportPeople = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        role: z.enum(["student", "teacher", "parent"]),
        rows: z.array(ImportRowSchema).min(1).max(50),
      })
      .refine((d) => d.role === "student" || d.rows.every((r) => r.email), {
        message: "Teachers and parents need an email address.",
      })
      .parse(data),
  )
  .handler(async (opts) => {
    const { bulkImportPeopleHandler } = await import("./import.server");
    return bulkImportPeopleHandler(opts);
  });
