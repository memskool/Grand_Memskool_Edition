import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import {
  adminCreate,
  adminGetById,
  adminIsSuspended,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";

const checkoutSchema = z.object({
  itemId: z.string().min(1),
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

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId } = context;

    if (await adminIsSuspended(userId)) {
      throw new Error("Your account is suspended and cannot make purchases.");
    }

    const { requireFlutterwaveSecret, buildReference, createFlutterwaveCheckout, toProviderAmount } =
      await import("./payments.server");
    requireFlutterwaveSecret();

    const item = await adminGetById<{
      title: string;
      kind: string;
      price_cents: number;
      currency: string;
      active: boolean;
      school_id?: string | null;
    }>(COLLECTIONS.marketplaceItems, data.itemId);
    if (!item || !item.active) throw new Error("This listing is no longer available.");
    if (item.school_id && context.schoolId && item.school_id !== context.schoolId) {
      throw new Error("You cannot buy listings from another school.");
    }

    const profile = await adminGetById<{ full_name: string; email: string | null }>(
      COLLECTIONS.users,
      userId,
    );
    const email = profile?.email ?? context.email;
    if (!email) throw new Error("Add an email address to your profile before paying.");

    const quantity = item.kind === "tutoring" ? 1 : data.quantity;
    const amountCents = item.price_cents * quantity;

    const reference = buildReference();
    const origin = new URL(getRequest().url).origin;

    const orderId = await adminCreate(COLLECTIONS.orders, {
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
      created_at: new Date().toISOString(),
    });

    const paymentLink = await createFlutterwaveCheckout({
      reference,
      amount: toProviderAmount(amountCents, item.currency),
      currency: item.currency,
      email,
      name: profile?.full_name || "Memskool learner",
      title: item.title,
      redirectUrl: `${origin}/marketplace?ref=${reference}`,
    });

    await adminUpdate(COLLECTIONS.orders, orderId, { payment_link: paymentLink });

    return { reference, paymentLink, amountCents, currency: item.currency };
  });

export const reconcileOrder = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => z.object({ reference: z.string().max(64) }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const orders = await adminWhere<{
      reference: string;
      status: string;
      provider_tx_id?: string | null;
      buyer_id: string;
    }>(COLLECTIONS.orders, "reference", "==", data.reference);
    const order = orders[0];
    if (!order || order.buyer_id !== userId) throw new Error("Order not found.");
    if (order.status !== "pending" || !order.provider_tx_id) return { status: order.status };

    const { verifyFlutterwaveTransaction } = await import("./payments.server");
    const { applyPaymentResult } = await import("./payments-apply.server");
    const verification = await verifyFlutterwaveTransaction(order.provider_tx_id);
    const status = await applyPaymentResult(verification);
    return { status };
  });
