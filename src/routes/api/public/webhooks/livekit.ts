import { createFileRoute } from "@tanstack/react-router";
import { sessionIdFromRoom } from "@/features/live-classroom/contracts";

/**
 * LiveKit webhooks. Authenticated by the provider JWT (`Authorization` header),
 * never trusted from the payload alone. Duplicate event ids are ignored.
 */
export const Route = createFileRoute("/api/public/webhooks/livekit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LIVEKIT_API_KEY"];
        const apiSecret = process.env["LIVEKIT_API_SECRET"];
        if (!apiKey || !apiSecret) {
          return new Response("Not configured", { status: 503 });
        }

        const raw = await request.text();
        if (raw.length > 200_000) return new Response("Payload too large", { status: 413 });

        const auth = request.headers.get("Authorization") ?? request.headers.get("Authorize") ?? "";

        try {
          const { WebhookReceiver } = await import("livekit-server-sdk");
          const receiver = new WebhookReceiver(apiKey, apiSecret);
          const event = await receiver.receive(raw, auth);

          const { adminGetById, adminSet } = await import("@/lib/firebase/admin-repo");
          const { COLLECTIONS } = await import("@/lib/firebase/repo");

          const eventId =
            event.id || `${event.event}-${String(event.createdAt)}-${event.room?.name ?? ""}`;
          const existing = await adminGetById(COLLECTIONS.liveSessionEvents, eventId);
          if (existing) return Response.json({ received: true, duplicate: true });

          await adminSet(COLLECTIONS.liveSessionEvents, eventId, {
            provider: "livekit",
            event_id: eventId,
            event_type: event.event,
            room: event.room?.name ?? null,
            created_at: new Date().toISOString(),
          });

          const sessionId = sessionIdFromRoom(event.room?.name);
          const identity = event.participant?.identity;

          if (sessionId && identity) {
            const { markParticipantConnected, markParticipantLeft } =
              await import("@/features/live-classroom/participation");
            if (event.event === "participant_joined") {
              await markParticipantConnected(sessionId, identity);
            }
            if (
              event.event === "participant_left" ||
              event.event === "participant_connection_aborted"
            ) {
              await markParticipantLeft(sessionId, identity);
            }
          }

          return Response.json({ received: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "invalid";
          if (message.toLowerCase().includes("jwt") || message.toLowerCase().includes("auth")) {
            return new Response("Invalid signature", { status: 401 });
          }
          console.error("livekit webhook processing failed");
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});
