/**
 * Server-only payment helpers. Never import this from a component or a
 * `*.functions.ts` module scope — load it inside a handler.
 */

export const FLW_API = "https://api.flutterwave.com/v3";

export function requireFlutterwaveSecret(): string {
  const key = process.env["FLUTTERWAVE_SECRET_KEY"];
  if (!key) {
    throw new Error(
      "Payments are not configured yet. FLUTTERWAVE_SECRET_KEY is missing on the server.",
    );
  }
  return key;
}

/** Flutterwave expects major units. UGX is a zero-decimal currency. */
export function toProviderAmount(amountCents: number, currency: string): number {
  return currency.toUpperCase() === "UGX" ? amountCents : amountCents / 100;
}

export function toStoredCents(providerAmount: number, currency: string): number {
  return Math.round(
    currency.toUpperCase() === "UGX" ? providerAmount : providerAmount * 100,
  );
}

export function buildReference(): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `MSK-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export type FlutterwaveVerification = {
  status: string;
  amount: number;
  currency: string;
  tx_ref: string;
  id: number | string;
  processor_response?: string;
};

/** Server-side truth: ask Flutterwave what actually happened. */
export async function verifyFlutterwaveTransaction(
  transactionId: string | number,
): Promise<FlutterwaveVerification> {
  const res = await fetch(`${FLW_API}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${requireFlutterwaveSecret()}` },
  });
  const body = (await res.json()) as { status?: string; data?: FlutterwaveVerification };
  if (!res.ok || !body.data) {
    throw new Error(`Flutterwave verification failed (${res.status})`);
  }
  return body.data;
}

export async function createFlutterwaveCheckout(input: {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  name: string;
  phone?: string | undefined;
  title: string;
  redirectUrl: string;
}): Promise<string> {
  const res = await fetch(`${FLW_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireFlutterwaveSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: input.reference,
      amount: input.amount,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      payment_options: "card,mobilemoneyuganda,ussd,banktransfer",
      customer: { email: input.email, name: input.name, phonenumber: input.phone },
      customizations: { title: "Memskool", description: input.title },
    }),
  });
  const body = (await res.json()) as { data?: { link?: string }; message?: string };
  if (!res.ok || !body.data?.link) {
    throw new Error(body.message ?? "Could not start the payment. Please try again.");
  }
  return body.data.link;
}
