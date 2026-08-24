import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { adminCol, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import { isSchoolManager } from "@/types/roles";

export const flushNotifications = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    try {
      const { adminGetById, adminSet } = await import("@/lib/firebase/admin-repo");
      const lock = await adminGetById<{ last_at?: string }>("ops_locks", `flush_${context.userId}`);
      if (lock?.last_at && Date.now() - Date.parse(lock.last_at) < 15_000) {
        return { ok: true, claimed: 0, sent: 0, failed: 0, skipped: 0 };
      }
      await adminSet("ops_locks", `flush_${context.userId}`, {
        last_at: new Date().toISOString(),
        user_id: context.userId,
      });
      const { processPendingDeliveries } = await import("./notifications.server");
      const result = await processPendingDeliveries();
      return { ok: true, ...result };
    } catch (error) {
      console.error(
        "[notifications] flush failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return { ok: false, claimed: 0, sent: 0, failed: 0, skipped: 0 };
    }
  });

const announcementSchema = z.object({
  classId: z.string().min(1).nullable().optional(),
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(1000),
  includeParents: z.boolean().default(true),
});

export const broadcastAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => announcementSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, role, schoolId } = context;
    const isAdmin = isSchoolManager(role);
    const isTeacher = role === "teacher";
    if (!isAdmin && !isTeacher) throw new Error("Only teachers and admins can send announcements.");

    if (data.classId && !isAdmin) {
      const cls = await adminCol(COLLECTIONS.classes).doc(data.classId).get();
      if (!cls.exists || cls.data()?.["teacher_id"] !== userId) {
        throw new Error("You do not teach this class.");
      }
    }
    if (!data.classId && !isAdmin) {
      throw new Error("Only admins can send a school-wide announcement.");
    }

    let studentIds: string[] = [];
    if (data.classId) {
      const rows = await adminWhere<{ student_id: string }>(
        COLLECTIONS.classEnrollments,
        "class_id",
        "==",
        data.classId,
      );
      studentIds = rows.map((r) => r.student_id);
    } else if (schoolId) {
      const rows = await adminWhere<{ role: string }>(
        COLLECTIONS.users,
        "school_id",
        "==",
        schoolId,
        [["role", "==", "student"]],
      );
      studentIds = rows.map((r) => r.id);
    }

    const recipients = new Set(studentIds);
    if (data.includeParents && studentIds.length) {
      for (const chunk of chunkIds(studentIds, 10)) {
        const parents = await adminWhere<{ parent_id: string; student_id: string }>(
          COLLECTIONS.parentStudents,
          "student_id",
          "in",
          chunk,
        );
        for (const p of parents) recipients.add(p.parent_id);
      }
    }

    if (recipients.size === 0) return { recipients: 0 };

    const now = new Date().toISOString();
    const { createAndQueueNotification, dispatchNotifications } =
      await import("./notifications.server");
    await Promise.all(
      [...recipients].map((id) =>
        createAndQueueNotification({
          userId: id,
          title: data.title,
          body: data.body,
          kind: "announcement",
          link: "/dashboard",
          schoolId,
          createdAt: now,
        }),
      ),
    );
    void dispatchNotifications();

    return { recipients: recipients.size };
  });

function chunkIds(ids: string[], size: number) {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}
