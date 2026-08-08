import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Drains queued email/SMS deliveries. Called by the app right after an action
 * that creates notifications (application review, grading, discipline,
 * announcements) so users get alerts without waiting for the cron sweep.
 * Always resolves — delivery problems must never fail the academic action.
 */
export const flushNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
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
  classId: z.string().uuid().nullable().optional(),
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(1000),
  includeParents: z.boolean().default(true),
});

/**
 * Teacher/admin announcement broadcast. Writes one in-app notification per
 * recipient (the source of truth); the fan-out trigger then queues email and
 * SMS for anyone who has those channels enabled.
 */
export const broadcastAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => announcementSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isTeacher } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "teacher",
    });
    if (!isAdmin && !isTeacher) throw new Error("Only teachers and admins can send announcements.");

    if (data.classId && !isAdmin) {
      const { data: teaches } = await supabase.rpc("teaches_class", {
        _user_id: userId,
        _class_id: data.classId,
      });
      if (!teaches) throw new Error("You do not teach this class.");
    }
    if (!data.classId && !isAdmin) {
      throw new Error("Only admins can send a school-wide announcement.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let studentIds: string[] = [];
    if (data.classId) {
      const { data: rows } = await supabaseAdmin
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", data.classId);
      studentIds = (rows ?? []).map((r) => r.student_id);
    } else {
      const { data: rows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      studentIds = (rows ?? []).map((r) => r.user_id);
    }

    const recipients = new Set(studentIds);
    if (data.includeParents && studentIds.length) {
      const { data: parents } = await supabaseAdmin
        .from("parent_students")
        .select("parent_id")
        .in("student_id", studentIds);
      for (const p of parents ?? []) recipients.add(p.parent_id);
    }

    if (recipients.size === 0) return { recipients: 0 };

    const payload = [...recipients].map((id) => ({
      user_id: id,
      title: data.title,
      body: data.body,
      kind: "announcement",
      link: "/dashboard",
    }));

    const { error } = await supabaseAdmin.from("notifications").insert(payload);
    if (error) throw error;

    const { dispatchNotifications } = await import("./notifications.server");
    void dispatchNotifications();

    return { recipients: recipients.size };
  });
