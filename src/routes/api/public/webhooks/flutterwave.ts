import { createFileRoute } from "@tanstack/react-router";

/**
 * Flutterwave webhook. Public by necessity — every request is authenticated by
 * the shared `verif-hash` secret, and the payment outcome is then re-fetched
 * from Flutterwave rather than trusted from the payload.
 */
export const Route = createFileRoute("/api/public/webhooks/flutterwave")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["FLUTTERWAVE_WEBHOOK_HASH"];
        if (!expected) {
          console.error("flutterwave webhook: FLUTTERWAVE_WEBHOOK_HASH not configured");
          return new Response("Not configured", { status: 503 });
        }

        const signature = request.headers.get("verif-hash") ?? "";
        if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const raw = await request.text();
        if (raw.length > 100_000) return new Response("Payload too large", { status: 413 });

        let payload: {
          event?: string;
          data?: { id?: number | string; tx_ref?: string; status?: string };
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const transactionId = payload.data?.id;
        const txRef = payload.data?.tx_ref;
        if (!transactionId || !txRef) return new Response("Missing transaction", { status: 400 });

        const { adminGetById, adminSet, adminUpdate, adminDelete } =
          await import("@/lib/firebase/admin-repo");
        const { COLLECTIONS } = await import("@/lib/firebase/repo");

        const eventId = `${txRef}:${transactionId}:${payload.data?.status ?? "unknown"}`;
        const existing = await adminGetById(COLLECTIONS.paymentEvents, eventId);
        if (existing) {
          return Response.json({ received: true, duplicate: true });
        }
        await adminSet(COLLECTIONS.paymentEvents, eventId, {
          provider: "flutterwave",
          event_id: eventId,
          event_type: payload.event ?? null,
          order_reference: txRef,
          status: payload.data?.status ?? null,
          payload: JSON.parse(raw) as never,
          created_at: new Date().toISOString(),
        });

        try {
          const { verifyFlutterwaveTransaction } = await import("@/lib/payments.server");
          const { applyPaymentResult } = await import("@/lib/payments-apply.server");
          const verification = await verifyFlutterwaveTransaction(transactionId);
          const status = await applyPaymentResult(verification);
          await adminUpdate(COLLECTIONS.paymentEvents, eventId, {
            processed_at: new Date().toISOString(),
          });
          return Response.json({ received: true, status });
        } catch (error) {
          console.error("flutterwave webhook processing failed", error);
          await adminDelete(COLLECTIONS.paymentEvents, eventId);
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
