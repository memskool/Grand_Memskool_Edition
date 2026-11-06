import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { z } from "zod";

export const setSchoolMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ memberId: z.string().min(1), status: z.enum(["pending", "approved", "rejected"]) })
      .parse(data),
  )
  .handler(async (opts) => {
    const { setSchoolMemberStatusHandler } = await import("./members.server");
    return setSchoolMemberStatusHandler(opts);
  });

export const listSchoolMembers = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async (opts) => {
    const { listSchoolMembersHandler } = await import("./members.server");
    return listSchoolMembersHandler(opts);
  });

export const remindSchoolApproval = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ schoolId: z.string().min(1) }).parse(data))
  .handler(async (opts) => {
    const { remindSchoolApprovalHandler } = await import("./members.server");
    return remindSchoolApprovalHandler(opts);
  });

export const linkParentStudent = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ parentId: z.string().min(1), studentId: z.string().min(1) }).parse(data),
  )
  .handler(async (opts) => {
    const { linkParentStudentHandler } = await import("./members.server");
    return linkParentStudentHandler(opts);
  });

export const unlinkParentStudent = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ linkId: z.string().min(1) }).parse(data))
  .handler(async (opts) => {
    const { unlinkParentStudentHandler } = await import("./members.server");
    return unlinkParentStudentHandler(opts);
  });

export const requestTeacherSchoolJoin = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ schoolCode: z.string().trim().min(3).max(24) }).parse(data),
  )
  .handler(async (opts) => {
    const { requestTeacherSchoolJoinHandler } = await import("./members.server");
    return requestTeacherSchoolJoinHandler(opts);
  });
