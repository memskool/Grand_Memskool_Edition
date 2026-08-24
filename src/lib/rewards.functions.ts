import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { adminGetById, adminSet } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";

export const recordDailyCheckIn = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    if (context.role !== "student") throw new Error("Only students can check in.");
    if (!context.schoolId) throw new Error("You are not attached to a school.");
    const day = new Date().toISOString().slice(0, 10);
    const id = `${context.userId}_${day}`;
    const existing = await adminGetById(COLLECTIONS.rewardEvents, id);
    if (existing) return { ok: true as const, duplicate: true };
    await adminSet(COLLECTIONS.rewardEvents, id, {
      student_id: context.userId,
      school_id: context.schoolId,
      kind: "daily_checkin",
      points: 5,
      note: "Daily check-in",
      created_at: new Date().toISOString(),
    });
    return { ok: true as const, duplicate: false };
  });
