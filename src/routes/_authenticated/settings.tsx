import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile, useRole } from "@/hooks/useAuth";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Receipt } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { formatPrice, useMyOrders } from "@/lib/marketplace-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from "@/lib/notifications-data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Memskool" },
      {
        name: "description",
        content: "Manage your Memskool profile details, contact information and account role.",
      },
      { property: "og:title", content: "Settings — Memskool" },
      { property: "og:description", content: "Manage your profile and account preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user ?? null);
  const { data: role } = useRole(user ?? null);
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const orders = useMyOrders(user?.id);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone((profile as { phone?: string | null }).phone ?? "");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    void qc.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your Memskool account." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile" description="How you appear across the platform">
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="st-name">Full name</Label>
              <Input id="st-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-phone">Mobile number</Label>
              <Input
                id="st-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2567XXXXXXXX"
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">
                Used for urgent SMS alerts only. Include the country code.
              </p>
            </div>
            <Button type="submit" className="rounded-full" disabled={saving}>
              Save changes
            </Button>
          </form>
        </Panel>

        <Panel title="Account" description="Read-only account details">
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge variant="secondary" className="rounded-full capitalize">
                  {role ?? "student"}
                </Badge>
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <NotificationPreferencesPanel userId={user?.id} />

      <Panel
        className="mt-6"
        title="Receipts & transactions"
        description="Every marketplace purchase and tutoring booking"
      >
        {orders.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (orders.data ?? []).length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            hint="Books, revision resources and tutoring bookings show up here."
          />
        ) : (
          <ul className="space-y-3">
            {(orders.data ?? []).map((o) => (
              <li key={o.id} className="rounded-2xl border border-border p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.item_title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {o.reference} · {o.provider} · {formatDateTime(o.created_at)}
                    </p>
                    {o.scheduled_at ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Session: {formatDateTime(o.scheduled_at)}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">{formatPrice(o.amount_cents, o.currency)}</p>
                    <Badge
                      variant={o.status === "paid" ? "secondary" : "outline"}
                      className="mt-1 rounded-full capitalize"
                    >
                      {o.status}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function NotificationPreferencesPanel({ userId }: { userId?: string | undefined }) {
  const prefs = useNotificationPreferences(userId);
  const save = useSaveNotificationPreferences(userId);
  const value = prefs.data ?? { email_enabled: true, sms_enabled: true };

  const update = (patch: { email_enabled?: boolean; sms_enabled?: boolean }) => {
    save.mutate(
      {
        email_enabled: patch.email_enabled ?? value.email_enabled,
        sms_enabled: patch.sms_enabled ?? value.sms_enabled,
      },
      {
        onSuccess: () => toast.success("Notification preferences saved"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not save preferences"),
      },
    );
  };

  return (
    <Panel
      className="mt-6"
      title="Notifications"
      description="In-app alerts are always on. Choose how else we reach you."
    >
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">Email</span>
            <span className="block text-xs text-muted-foreground">
              Admissions, grades, payments, meetings and account notices.
            </span>
          </span>
          <Switch
            checked={value.email_enabled}
            disabled={prefs.isLoading || save.isPending}
            onCheckedChange={(checked) => update({ email_enabled: checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">SMS</span>
            <span className="block text-xs text-muted-foreground">
              Only urgent items: admissions decisions, discipline, meetings and payments.
            </span>
          </span>
          <Switch
            checked={value.sms_enabled}
            disabled={prefs.isLoading || save.isPending}
            onCheckedChange={(checked) => update({ sms_enabled: checked })}
          />
        </label>
      </div>
    </Panel>
  );
}
