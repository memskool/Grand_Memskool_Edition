import "@tanstack/react-start/server-only";
import { adminGetById, adminWhere } from "@/lib/firebase/admin-repo";
import { adminDb } from "@/lib/firebase/admin.server";
import { COLLECTIONS } from "@/lib/firebase/repo";

/**
 * Same-day absence alerts to linked parents (Phase 6, section C).
 *
 * One alert per child per day, however many lessons they miss: an `absence_alerts/{date}_{student}`
 * marker is created atomically first, so re-finalising a live class or re-saving a register
 * never alerts twice. Schools can switch alerts off with `schools.absence_alerts_enabled = false`.
 * Never throws: attendance is already saved, and an alert failure must not undo that.
 */
export async function alertParentsOfAbsences(input: {
  schoolId: string;
  studentIds: string[];
  /** YYYY-MM-DD of the lesson. */
  date: string;
  /** Human label, e.g. "S1 East (live class)". */
  where: string;
}): Promise<{ alerted: number }> {
  let alerted = 0;
  try {
    const school = await adminGetById<{ absence_alerts_enabled?: boolean; name?: string }>(
      COLLECTIONS.schools,
      input.schoolId,
    );
    if (school?.absence_alerts_enabled === false) return { alerted };
    const { createAndQueueNotification, dispatchNotifications } =
      await import("@/lib/notifications.server");
    const today = input.date === new Date().toISOString().slice(0, 10);

    for (const studentId of [...new Set(input.studentIds)]) {
      try {
        const parents = await adminWhere<{ parent_id: string; school_id?: string }>(
          COLLECTIONS.parentStudents,
          "student_id",
          "==",
          studentId,
        );
        const parentIds = [
          ...new Set(
            parents
              .filter((p) => !p.school_id || p.school_id === input.schoolId)
              .map((p) => p.parent_id),
          ),
        ];
        if (!parentIds.length) continue;
        try {
          await adminDb()
            .collection(COLLECTIONS.absenceAlerts)
            .doc(`${input.date}_${studentId}`)
            .create({
              school_id: input.schoolId,
              student_id: studentId,
              date: input.date,
              where: input.where,
              parent_ids: parentIds,
              created_at: new Date().toISOString(),
            });
        } catch {
          continue; // already alerted for this child today
        }
        const student = await adminGetById<{ full_name?: string }>(COLLECTIONS.users, studentId);
        const name = student?.full_name?.trim() || "Your child";
        for (const parentId of parentIds) {
          await createAndQueueNotification({
            userId: parentId,
            title: `${name} was marked absent${today ? " today" : ""}`,
            body: `Absent from ${input.where} on ${input.date}. If this is a mistake, contact ${school?.name ?? "the school"}.`,
            kind: "attendance",
            link: "/grades",
            schoolId: input.schoolId,
          });
          alerted += 1;
        }
      } catch (error) {
        console.error(
          "[absence-alerts] student failed:",
          error instanceof Error ? error.message.slice(0, 160) : "unknown",
        );
      }
    }
    if (alerted) void dispatchNotifications(alerted);
  } catch (error) {
    console.error(
      "[absence-alerts] failed:",
      error instanceof Error ? error.message.slice(0, 160) : "unknown",
    );
  }
  return { alerted };
}
