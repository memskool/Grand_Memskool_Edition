import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { reconcileOrder, startCheckout } from "@/lib/payments.functions";
import { COLLECTIONS, createDoc, findMany, where, orderBy, limit } from "@/lib/firebase/repo";
import { attachSubject, attachNamedUser, userSchoolId } from "@/lib/firebase/hydrate";

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

export function useMarketplaceItems(userId?: string) {
  return useQuery({
    queryKey: ["marketplace-items", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MarketplaceItem[]> => {
      const schoolId = await userSchoolId(userId);
      if (!schoolId) return [];
      const rows = await findMany<
        Omit<MarketplaceItem, "seller" | "subject"> & { subject_id?: string | null }
      >(COLLECTIONS.marketplaceItems, [
        where("school_id", "==", schoolId),
        where("active", "==", true),
        orderBy("created_at", "desc"),
        limit(40),
      ]);
      return Promise.all(
        rows.map(async (row) => {
          const withSeller = await attachNamedUser(row, row.seller_id, "seller");
          const withSubject = await attachSubject(row);
          return {
            ...row,
            seller: withSeller.seller ? { full_name: withSeller.seller.full_name } : null,
            subject: withSubject.subject ? { name: withSubject.subject.name } : null,
          };
        }),
      );
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
      const schoolId = await userSchoolId(sellerId);
      await createDoc(COLLECTIONS.marketplaceItems, {
        ...input,
        seller_id: sellerId!,
        school_id: schoolId,
        active: true,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketplace-items"] }),
  });
}

export function useMyOrders(buyerId?: string) {
  return useQuery({
    queryKey: ["orders", buyerId],
    enabled: !!buyerId,
    queryFn: async (): Promise<Order[]> => {
      return findMany<Order>(COLLECTIONS.orders, [
        where("buyer_id", "==", buyerId!),
        orderBy("created_at", "desc"),
        limit(40),
      ]);
    },
  });
}

export type CheckoutInput = {
  item: MarketplaceItem;
  quantity: number;
  scheduledAt: string | null;
  notes: string | null;
};

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
