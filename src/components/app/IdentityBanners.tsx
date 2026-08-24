import { Shield, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/access";
import { reloadAuthUser, resendVerification } from "@/features/auth/services/auth.service";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { useEffect, useState } from "react";

export function IdentityBanners() {
  const { pendingApproval, schoolName, emailVerified, suspended } = useAccess();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (emailVerified) return;
    const onFocus = () => {
      void reloadAuthUser().then((user) => {
        if (user?.emailVerified) window.location.reload();
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [emailVerified]);

  const resend = async () => {
    setSending(true);
    try {
      await resendVerification();
      toast.success("Sent from notifications@memskool.com — check spam if it is not in the inbox.");
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
    setSending(false);
  };

  return (
    <div className="mb-4 space-y-2">
      {suspended ? (
        <p className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <Shield className="mt-0.5 size-4 shrink-0" />
          Your account is suspended. You can still read notices and open Settings, but teaching and
          live tools stay locked until the school lifts it.
        </p>
      ) : null}
      {pendingApproval ? (
        <p className="flex items-start gap-2 rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0" />
          {schoolName
            ? `${schoolName} has not approved your teacher account yet.`
            : "Join a school with its School ID so they can approve your teacher account."}
        </p>
      ) : null}
      {!emailVerified ? (
        <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 size-4 shrink-0" />
              Confirm your email so we can recover your account if you forget the password.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={sending}
              onClick={() => void resend()}
            >
              {sending ? "Sending…" : "Resend email"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
