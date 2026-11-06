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

          const { adminGetById, adminSet, adminUpdate } = await import("@/lib/firebase/admin-repo");
          const { COLLECTIONS } = await import("@/lib/firebase/repo");

          const eventId =
            event.id || `${event.event}-${String(event.createdAt)}-${event.room?.name ?? ""}`;
          const existing = await adminGetById(COLLECTIONS.liveSessionEvents, eventId);
          if (existing) return Response.json({ received: true, duplicate: true });

          const sessionId = sessionIdFromRoom(event.room?.name);
          const identity = event.participant?.identity;

          if (sessionId && identity) {
            const { markParticipantConnected, markParticipantLeft, closeOpenParticipants } =
              await import("@/features/live-classroom/participation");
            if (event.event === "participant_joined") {
              await markParticipantConnected(sessionId, identity);
            }
            if (
              event.event === "participant_left" ||
              event.event === "participant_connection_aborted"
            ) {
              await markParticipantLeft(sessionId, identity);
              // Host disconnect ends the session and finalizes attendance (Phase 5+6).
              try {
                const session = await adminGetById<{
                  id?: string;
                  host_id?: string;
                  is_active?: boolean;
                  status?: string;
                  lesson_id?: string | null;
                  school_id?: string | null;
                  class_id?: string;
                  kind?: string | null;
                  started_at?: string;
                  gold_class_id?: string | null;
                }>(COLLECTIONS.classroomSessions, sessionId);
                if (
                  session &&
                  session.host_id === identity &&
                  session.is_active !== false &&
                  (session.status ?? "live") === "live"
                ) {
                  const now = new Date().toISOString();
                  await closeOpenParticipants(sessionId);
                  const { finalizeLiveAttendance } =
                    await import("@/features/live-classroom/attendance");
                  await finalizeLiveAttendance({
                    session: {
                      id: sessionId,
                      school_id: session.school_id ?? null,
                      class_id: session.class_id ?? "",
                      host_id: session.host_id,
                      lesson_id: session.lesson_id ?? null,
                      ...(session.status !== undefined ? { status: session.status } : {}),
                      ...(session.is_active !== undefined ? { is_active: session.is_active } : {}),
                      ...(session.started_at !== undefined
                        ? { started_at: session.started_at }
                        : {}),
                      ...(session.kind != null ? { kind: session.kind } : {}),
                      ...(session.gold_class_id != null
                        ? { gold_class_id: session.gold_class_id }
                        : {}),
                    },
                    recordedBy: identity,
                  });
                  await adminUpdate(COLLECTIONS.classroomSessions, sessionId, {
                    status: "ended",
                    is_active: false,
                    ended_at: now,
                    attendance_finalized_at: now,
                  });
                  if (session.lesson_id) {
                    await adminUpdate(COLLECTIONS.lessons, session.lesson_id, {
                      status: "completed",
                      updated_at: now,
                    });
                  }
                }
              } catch (hostEndError) {
                console.error("[livekit webhook] host-leave end failed:", hostEndError);
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
