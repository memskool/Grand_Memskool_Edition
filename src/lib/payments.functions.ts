import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
  scheduledAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type CheckoutResult = {
  reference: string;
  paymentLink: string;
  amountCents: number;
  currency: string;
};

/**
 * Creates a pending order priced from the DATABASE (never from the browser)
 * and returns a Flutterwave hosted-checkout link. The order only becomes
 * `paid` after the signed webhook + server-side verification.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context;

    const { data: suspended } = await supabase.rpc("is_suspended", { _user_id: userId });
    if (suspended) throw new Error("Your account is suspended and cannot make purchases.");

    // Price, currency and title come from the server-side row only.
    const { data: item, error: itemError } = await supabase
      .from("marketplace_items")
      .select("id, title, kind, price_cents, currency, active")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item || !item.active) throw new Error("This listing is no longer available.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const email = profile?.email;
    if (!email) throw new Error("Add an email address to your profile before paying.");

    const quantity = item.kind === "tutoring" ? 1 : data.quantity;
    const amountCents = item.price_cents * quantity;

    const {
      buildReference,
      createFlutterwaveCheckout,
      toProviderAmount,
    } = await import("./payments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const reference = buildReference();
    const origin = new URL(getRequest().url).origin;

    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      buyer_id: userId,
      item_id: item.id,
      item_title: item.title,
      item_kind: item.kind,
      quantity,
      amount_cents: amountCents,
      currency: item.currency,
      status: "pending",
      provider: "flutterwave",
      reference,
      scheduled_at: data.scheduledAt ?? null,
      notes: data.notes ?? null,
    });
    if (insertError) throw insertError;

    const paymentLink = await createFlutterwaveCheckout({
      reference,
      amount: toProviderAmount(amountCents, item.currency),
      currency: item.currency,
      email,
      name: profile?.full_name || "Memskool learner",
      title: item.title,
      redirectUrl: `${origin}/marketplace?ref=${reference}`,
    });

    await supabaseAdmin.from("orders").update({ payment_link: paymentLink }).eq("reference", reference);

    return { reference, paymentLink, amountCents, currency: item.currency };
  });

/**
 * Called when the buyer returns from the hosted checkout. Re-verifies with the
 * provider rather than trusting anything in the redirect URL.
 */
export const reconcileOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ reference: z.string().max(64) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("orders")
      .select("reference, status, provider_tx_id, buyer_id")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!order || order.buyer_id !== userId) throw new Error("Order not found.");
    if (order.status !== "pending" || !order.provider_tx_id) return { status: order.status };

    const { verifyFlutterwaveTransaction } = await import("./payments.server");
    const { applyPaymentResult } = await import("./payments-apply.server");
    const verification = await verifyFlutterwaveTransaction(order.provider_tx_id);
    const status = await applyPaymentResult(verification);
    return { status };
  });
