import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { reconcileOrder, startCheckout } from "@/lib/payments.functions";

export const ITEM_KINDS = [
  { value: "book", label: "Book" },
  { value: "resource", label: "Revision resource" },
  { value: "tutoring", label: "1-on-1 tutoring" },
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number]["value"];

export type MarketplaceItem = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  price_cents: number;
  currency: string;
  class_level: string | null;
  duration_minutes: number | null;
  cover_url: string | null;
  seller_id: string | null;
  active: boolean;
  seller: { full_name: string } | null;
  subject: { name: string } | null;
};

export type Order = {
  id: string;
  item_id: string | null;
  item_title: string;
  item_kind: string;
  quantity: number;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  reference: string;
  scheduled_at: string | null;
  notes: string | null;
  created_at: string;
};

export function formatPrice(cents: number, currency: string) {
  const amount = currency === "UGX" ? cents : cents / 100;
  return `${currency} ${amount.toLocaleString()}`;
}

export function useMarketplaceItems() {
  return useQuery({
    queryKey: ["marketplace-items"],
    queryFn: async (): Promise<MarketplaceItem[]> => {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select(
          "id, title, description, kind, price_cents, currency, class_level, duration_minutes, cover_url, seller_id, active, seller:profiles(full_name), subject:subjects(name)",
        )
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MarketplaceItem[];
    },
  });
}

export type NewItem = {
  title: string;
  description: string;
  kind: ItemKind;
  price_cents: number;
  currency: string;
  duration_minutes: number | null;
  class_level: string | null;
};

export function useCreateItem(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewItem) => {
      const { error } = await supabase
        .from("marketplace_items")
        .insert({ ...input, seller_id: sellerId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketplace-items"] }),
  });
}

export function useMyOrders(buyerId?: string) {
  return useQuery({
    queryKey: ["orders", buyerId],
    enabled: !!buyerId,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, item_id, item_title, item_kind, quantity, amount_cents, currency, status, provider, reference, scheduled_at, notes, created_at",
        )
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });
}

export type CheckoutInput = {
  item: MarketplaceItem;
  quantity: number;
  scheduledAt: string | null;
  notes: string | null;
};

/**
 * Real checkout: the server prices the order from the database, creates a
 * pending order and returns a Flutterwave hosted-checkout link. The browser
 * never decides the amount or the paid status.
 */
export function useCheckout(_buyerId?: string) {
  const start = useServerFn(startCheckout);
  return useMutation({
    mutationFn: async ({ item, quantity, scheduledAt, notes }: CheckoutInput) =>
      start({
        data: {
          itemId: item.id,
          quantity,
          scheduledAt: scheduledAt ?? null,
          notes: notes ?? null,
        },
      }),
  });
}

/** Re-verifies with the provider after the buyer returns from checkout. */
export function useReconcileOrder(buyerId?: string) {
  const qc = useQueryClient();
  const reconcile = useServerFn(reconcileOrder);
  return useMutation({
    mutationFn: async (reference: string) => reconcile({ data: { reference } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders", buyerId] });
    },
  });
}
