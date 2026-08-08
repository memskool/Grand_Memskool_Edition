import { createFileRoute } from "@tanstack/react-router";

/**
 * Notification delivery worker endpoint.
 *
 * Public prefix so an external scheduler can call it, but every request must
 * present the shared `NOTIFICATIONS_DISPATCH_SECRET`. It drains queued email /
 * SMS deliveries and is safe to call as often as every minute — claiming is
 * idempotent, so overlapping runs never double-send.
 */
export const Route = createFileRoute("/api/public/notifications/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["NOTIFICATIONS_DISPATCH_SECRET"];
        if (!expected) {
          console.error("notification dispatch: NOTIFICATIONS_DISPATCH_SECRET not configured");
          return new Response("Not configured", { status: 503 });
        }
        const provided = request.headers.get("x-dispatch-secret") ?? "";
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { processPendingDeliveries } = await import("@/lib/notifications.server");
        const result = await processPendingDeliveries();
        return Response.json(result);
      },
    },
  },
});

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
