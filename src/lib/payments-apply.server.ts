import type { FlutterwaveVerification } from "./payments.server";

/**
 * Single place where an order's money state changes. Idempotent: an order that
 * already reached a terminal state is never rewritten, so webhook retries and
 * the redirect-return reconcile can both run safely.
 */
export async function applyPaymentResult(verification: FlutterwaveVerification): Promise<string> {
  const { toStoredCents } = await import("./payments.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, item_title, amount_cents, currency, status, reference")
    .eq("reference", verification.tx_ref)
    .maybeSingle();

  if (!order) return "unknown_order";
  if (order.status === "paid" || order.status === "failed") return order.status;

  const paidCents = toStoredCents(Number(verification.amount ?? 0), verification.currency ?? "");
  const currencyMatches =
    (verification.currency ?? "").toUpperCase() === order.currency.toUpperCase();
  const amountMatches = paidCents >= order.amount_cents;
  const successful = verification.status === "successful" && currencyMatches && amountMatches;

  const status = successful ? "paid" : verification.status === "cancelled" ? "cancelled" : "failed";
  const failureReason = successful
    ? null
    : !currencyMatches || !amountMatches
      ? "Amount or currency did not match the order"
      : (verification.processor_response ?? `Payment ${verification.status}`);

  await supabaseAdmin
    .from("orders")
    .update({
      status,
      provider_tx_id: String(verification.id),
      verified_amount_cents: paidCents,
      failure_reason: failureReason,
      paid_at: successful ? new Date().toISOString() : null,
    })
    .eq("id", order.id)
    .eq("status", "pending");

  await supabaseAdmin.from("notifications").insert({
    user_id: order.buyer_id,
    title: successful ? "Payment successful" : "Payment did not go through",
    body: successful
      ? `Your payment for ${order.item_title} is confirmed. Receipt ${order.reference}.`
      : `We could not confirm your payment for ${order.item_title}. ${failureReason ?? ""}`.trim(),
    kind: "payment",
    link: "/marketplace",
  });

  // Email/SMS receipt. Fire-and-forget: a provider outage must never affect
  // the money state we just recorded.
  const { dispatchNotifications } = await import("./notifications.server");
  void dispatchNotifications();

  return status;
}
