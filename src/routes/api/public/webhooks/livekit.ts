import { createFileRoute } from "@tanstack/react-router";
import { sessionIdFromRoom } from "@/features/live-classroom/contracts";

/**
 * LiveKit webhooks. Authenticated by the provider JWT (`Authorization` header),
 * never trusted from the payload alone.
 * Phase 6: apply presence first, then record the idempotency key so a failed
 * presence write is retried instead of being skipped as a duplicate.
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
              // Phase 3: a host drop no longer ends the class at once. The class stays
              // open for HOST_RECONNECT_GRACE_MS; learners see a countdown, and
              // expireHostGrace ends it (attendance + room teardown) only if the host
              // has not come back. The host's own Leave / End still ends it immediately.
              try {
                const { noteHostDisconnected } =
                  await import("@/features/live-classroom/session.server");
                await noteHostDisconnected(sessionId, identity);
              } catch (hostDropError) {
                console.error("[livekit webhook] host-drop flag failed:", hostDropError);
              }
            }
          }

          // Record idempotency only after presence side-effects succeed.
          await adminSet(COLLECTIONS.liveSessionEvents, eventId, {
            provider: "livekit",
            event_id: eventId,
            event_type: event.event,
            room: event.room?.name ?? null,
            created_at: new Date().toISOString(),
          });

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
