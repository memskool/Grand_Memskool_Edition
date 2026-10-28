import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, GraduationCap, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { useSession, useRole } from "@/hooks/useAuth";
import { usePlatformCapabilities } from "@/hooks/usePlatformCapabilities";
import { PageHeader, Panel, EmptyState, ServiceNotice } from "@/components/app/primitives";
import { CheckoutModal } from "@/components/app/CheckoutModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_KINDS,
  formatPrice,
  useCreateItem,
  useMarketplaceItems,
  useReconcileOrder,
  type ItemKind,
  type MarketplaceItem,
} from "@/lib/marketplace-data";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace & Tutoring — Memskool" },
      {
        name: "description",
        content:
          "Buy extra books and revision resources, or book 1-on-1 private tutoring sessions with Memskool teachers.",
      },
      { property: "og:title", content: "Marketplace & Tutoring — Memskool" },
      {
        property: "og:description",
        content: "Extra books, revision packs and private tutoring, checkout in a few taps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketplacePage,
});

const KIND_ICON = {
  book: BookOpen,
  resource: Sparkles,
  tutoring: GraduationCap,
} as const;

function MarketplacePage() {
  const { user } = useSession();
  const { data: role } = useRole(user ?? null);
  const { data: capabilities } = usePlatformCapabilities();
  const { data: items, isLoading } = useMarketplaceItems(user?.id);
  const reconcile = useReconcileOrder(user?.id);
  const paymentsReady = capabilities?.payments === true;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("ref") ?? params.get("tx_ref");
    if (!reference) return;
    reconcile.mutate(reference, {
      onSuccess: (row) => {
        if (row.status === "paid") toast.success("Payment confirmed");
      },
      onError: (e) => toast.error(authErrorMessage(e)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const [tab, setTab] = useState<"all" | ItemKind>("all");
  const [search, setSearch] = useState("");
  const [checkoutItem, setCheckoutItem] = useState<MarketplaceItem | null>(null);

  const canSell = role === "admin" || role === "institution";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (tab === "all" || i.kind === tab) &&
        (!term ||
          i.title.toLowerCase().includes(term) ||
          (i.description ?? "").toLowerCase().includes(term)),
    );
  }, [items, tab, search]);

  return (
    <>
      <PageHeader
        title="Bookstore"
        subtitle={
          canSell
            ? "List extra books and revision packs for your school."
            : "Buy extra books and revision packs listed by schools."
        }
        action={canSell ? <NewItemDialog sellerId={user?.id} /> : undefined}
      />

      {capabilities && !capabilities.payments ? (
        <ServiceNotice title="Checkout is paused">
          Flutterwave keys are not on this server yet. You can browse listings. Buying and booking
          will turn on as soon as the school adds payment credentials.
        </ServiceNotice>
      ) : null}

      <div className="mb-6 grid gap-3 sm:flex sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="rounded-full">
            <TabsTrigger value="all" className="rounded-full">
              All
            </TabsTrigger>
            {ITEM_KINDS.map((k) => (
              <TabsTrigger key={k.value} value={k.value} className="rounded-full">
                {k.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the marketplace"
          className="sm:max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nothing here yet"
          hint="Teachers and admins can list books, revision packs and tutoring slots."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind as ItemKind] ?? BookOpen;
            return (
              <article key={item.id} className="surface-card flex flex-col gap-3 p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-base font-semibold">{item.title}</h2>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.seller?.full_name ?? "Memskool"}
                      {item.subject?.name ? ` · ${item.subject.name}` : ""}
                    </p>
                  </div>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                </div>

                {item.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                ) : null}

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="rounded-full capitalize">
                    {item.kind}
                  </Badge>
                  {item.class_level ? (
                    <Badge variant="outline" className="rounded-full">
                      {item.class_level}
                    </Badge>
                  ) : null}
                  {item.duration_minutes ? (
                    <Badge variant="outline" className="rounded-full">
                      {item.duration_minutes} min
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <span className="font-display text-lg font-semibold">
                    {formatPrice(item.price_cents, item.currency)}
                  </span>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={!paymentsReady}
                    onClick={() => setCheckoutItem(item)}
                  >
                    {item.kind === "tutoring" ? "Book" : "Buy"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CheckoutModal
        item={checkoutItem}
        buyerId={user?.id}
        onOpenChange={(open) => !open && setCheckoutItem(null)}
      />
    </>
  );
}

function NewItemDialog({ sellerId }: { sellerId?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ItemKind>("book");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [duration, setDuration] = useState("60");
  const [level, setLevel] = useState("");
  const create = useCreateItem(sellerId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !price) {
      toast.error("Add a title and a price");
      return;
    }
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        kind,
        price_cents: Math.max(0, Math.round(Number(price))),
        currency,
        duration_minutes: kind === "tutoring" ? Number(duration) || 60 : null,
        class_level: level.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Listing published");
          setOpen(false);
          setTitle("");
          setDescription("");
          setPrice("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not publish"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="size-4" />
          New listing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New listing</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mk-title">Title</Label>
            <Input
              id="mk-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mk-desc">Description</Label>
            <Textarea
              id="mk-desc"
              rows={3}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ItemKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mk-level">Class level</Label>
              <Input
                id="mk-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="S4, P7…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mk-price">Price</Label>
              <Input
                id="mk-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UGX">UGX</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind === "tutoring" ? (
              <div className="space-y-2">
                <Label htmlFor="mk-dur">Session length (min)</Label>
                <Input
                  id="mk-dur"
                  type="number"
                  min={15}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" className="rounded-full" disabled={create.isPending}>
              Publish listing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
