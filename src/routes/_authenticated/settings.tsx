import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { COLLECTIONS, patchById } from "@/lib/firebase/repo";
import { changePassword, hasPasswordProvider } from "@/features/auth/services/auth.service";
import { toUserMessage } from "@/lib/errors/app-error";
import { authErrorMessage } from "@/lib/errors/auth-errors";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from "@/lib/notifications-data";
import { uploadAvatar } from "@/lib/storage";
import { useTheme } from "@/components/app/ThemeToggle";

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
  const [uploading, setUploading] = useState(false);
  const orders = useMyOrders(user?.id);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await patchById(COLLECTIONS.users, user.id, {
        full_name: fullName,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      });
      toast.success("Profile updated");
      void qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your Memskool account." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile" description="How you appear across the platform">
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                <AvatarFallback className="text-base">
                  {(fullName || "M").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="st-avatar" className="text-sm font-medium">
                  Photo
                </Label>
                <Input
                  id="st-avatar"
                  type="file"
                  accept="image/*"
                  className="mt-1"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file || !user) return;
                    setUploading(true);
                    try {
                      const url = await uploadAvatar(file);
                      await patchById(COLLECTIONS.users, user.id, {
                        avatar_url: url,
                        updated_at: new Date().toISOString(),
                      });
                      toast.success("Photo updated");
                      void qc.invalidateQueries({ queryKey: ["profile"] });
                    } catch (error) {
                      toast.error(authErrorMessage(error));
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {uploading ? "Uploading…" : "PNG or JPEG, up to 5 MB."}
                </p>
              </div>
            </div>
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

      <AppearancePanel />

      <PasswordPanel />

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

function AppearancePanel() {
  const { theme, toggle } = useTheme();
  return (
    <Panel className="mt-6" title="Appearance" description="Saved on this device">
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>
          <span className="font-medium">Dark mode</span>
          <span className="block text-xs text-muted-foreground">
            Follows this browser. Your choice is remembered next time you visit.
          </span>
        </span>
        <Switch checked={theme === "dark"} onCheckedChange={() => toggle()} />
      </label>
    </Panel>
  );
}

function PasswordPanel() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const canSetPassword = hasPasswordProvider();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(password);
      setPassword("");
      setConfirm("");
      toast.success("Password updated");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!canSetPassword) {
    return (
      <Panel
        className="mt-6"
        title="Sign-in"
        description="This account uses Google, not a Memskool password"
      >
        <p className="text-sm text-muted-foreground">
          You signed in with Google, so there is no password to change here. Use{" "}
          <span className="font-medium text-foreground">Continue with Google</span> next time you
          sign in.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="mt-6" title="Password" description="Change your password at any time">
      <form onSubmit={submit} className="grid max-w-md gap-4">
        <div className="space-y-2">
          <Label htmlFor="st-pass">New password</Label>
          <Input
            id="st-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="st-pass2">Confirm new password</Label>
          <Input
            id="st-pass2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-fit rounded-full" disabled={saving}>
          {saving ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Panel>
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
        onError: (error) => toast.error(authErrorMessage(error)),
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
