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
import { formatPrice, useCheckout, type MarketplaceItem } from "@/lib/marketplace-data";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { usePlatformCapabilities } from "@/hooks/usePlatformCapabilities";

export function CheckoutModal({
  item,
  buyerId,
  onOpenChange,
}: {
  item: MarketplaceItem | null;
  buyerId?: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const checkout = useCheckout(buyerId);
  const { data: capabilities } = usePlatformCapabilities();
  const paymentsReady = capabilities?.payments === true;

  const tutoring = item?.kind === "tutoring";
  const total = item ? item.price_cents * quantity : 0;

  const submit = () => {
    if (!item || !buyerId) return;
    if (!paymentsReady) {
      toast.error("Checkout is not connected yet.");
      return;
    }
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
      },
      {
        onSuccess: (result) => {
          toast.success("Redirecting to secure payment…");
          window.location.href = result.paymentLink;
        },
        onError: (e) => toast.error(authErrorMessage(e)),
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
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                }
              />
            </div>
          )}

          <div className="rounded-2xl border border-border px-4 py-3">
            <p className="text-sm font-medium">
              {paymentsReady ? "Flutterwave secure checkout" : "Payments not connected yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {paymentsReady
                ? "Pay with MTN or Airtel mobile money, card, or bank transfer. You'll be taken to Flutterwave's secure page and returned here once the payment is confirmed."
                : "Checkout will open when the school adds Flutterwave keys. Browsing listings still works."}
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
          <Button
            className="rounded-full"
            onClick={submit}
            disabled={checkout.isPending || !paymentsReady}
          >
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
