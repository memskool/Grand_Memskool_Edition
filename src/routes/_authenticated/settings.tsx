import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile, useRole } from "@/hooks/useAuth";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: phone || null })
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
              <Label htmlFor="st-phone">Phone</Label>
              <Input id="st-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
    </>
  );
}
