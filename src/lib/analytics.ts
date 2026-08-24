import { logEvent } from "firebase/analytics";
import { getFirebaseAnalytics } from "@/lib/firebase/client";

/** Allowed Analytics event names. No student names, answers, or emails. */
export const PRODUCT_EVENTS = {
  workspaceOpen: "workspace_open",
  assessmentSubmitted: "assessment_submitted",
  classroomJoin: "classroom_join",
} as const;

type ProductEvent = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];

export async function trackProductEvent(
  name: ProductEvent,
  params?: { role?: string; outcome?: "success" | "failure" },
): Promise<void> {
  try {
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return;
    const payload: Record<string, string> = {};
    if (params?.role) payload["role"] = params.role;
    if (params?.outcome) payload["outcome"] = params.outcome;
    logEvent(analytics, name, payload);
  } catch {
    // Analytics must never break product flows.
  }
}
