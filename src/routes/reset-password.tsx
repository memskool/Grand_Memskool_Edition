import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import {
  changePassword,
  completePasswordReset,
  getCurrentAuthUser,
} from "@/features/auth/services/auth.service";
import { toUserMessage } from "@/lib/errors/app-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/app/SiteFooter";
import { PublicHeader } from "@/components/app/PublicHeader";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your Memskool password" },
      {
        name: "description",
        content:
          "Choose a new password for your Memskool account and get back to your classes, locker and assessments.",
      },
      { property: "og:title", content: "Reset your Memskool password" },
      {
        property: "og:description",
        content: "Set a new password for your Memskool account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oobCode");
    if (code) {
      setOobCode(code);
      setReady(true);
      return;
    }
    void getCurrentAuthUser().then((user) => setReady(!!user));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (oobCode) await completePasswordReset(oobCode, password);
      else await changePassword(password);
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="canvas-mesh flex min-h-screen flex-col">
      <PublicHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="brand-gradient brand-shadow mb-4 flex size-14 items-center justify-center rounded-3xl">
              <GraduationCap className="size-7" />
            </span>
            <h1 className="brand-text font-display text-3xl font-semibold tracking-tight">
              Set a new password
            </h1>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {ready
                ? "Choose a strong password you haven't used before."
                : "Open the reset link from your email to continue."}
            </p>
          </div>

          <div className="surface-card p-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rp-pass">New password</Label>
                <Input
                  id="rp-pass"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-confirm">Confirm password</Label>
                <Input
                  id="rp-confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={loading || !ready}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
