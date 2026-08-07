import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice, useCheckout, type MarketplaceItem } from "@/lib/marketplace-data";

export function CheckoutModal({
  item,
  buyerId,
  onOpenChange,
}: {
  item: MarketplaceItem | null;
  buyerId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [provider, setProvider] = useState<"flutterwave" | "stripe">("flutterwave");
  const checkout = useCheckout(buyerId);

  const tutoring = item?.kind === "tutoring";
  const total = item ? item.price_cents * quantity : 0;

  const submit = () => {
    if (!item || !buyerId) return;
    if (tutoring && !scheduledAt) {
      toast.error("Pick a session date and time");
      return;
    }
    checkout.mutate(
      {
        item,
        quantity: tutoring ? 1 : quantity,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        notes: notes.trim() || null,
        provider,
      },
      {
        onSuccess: (order) => {
          toast.success("Payment confirmed", { description: `Receipt ${order.reference}` });
          setQuantity(1);
          setScheduledAt("");
          setNotes("");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
      },
    );
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tutoring ? "Book a session" : "Checkout"}</DialogTitle>
          <DialogDescription>{item?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {tutoring ? (
            <div className="space-y-2">
              <Label htmlFor="co-when">Session date & time</Label>
              <Input
                id="co-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="co-qty">Quantity</Label>
              <Input
                id="co-qty"
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flutterwave">Flutterwave (mobile money / card)</SelectItem>
                <SelectItem value="stripe">Stripe (card)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sandbox mode — no real money moves until live payment keys are connected.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="co-notes">Notes for the tutor / seller</Label>
            <Textarea
              id="co-notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything they should know?"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-xl font-semibold">
              {item ? formatPrice(tutoring ? item.price_cents : total, item.currency) : "—"}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={submit} disabled={checkout.isPending}>
            {checkout.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}
            Pay now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
