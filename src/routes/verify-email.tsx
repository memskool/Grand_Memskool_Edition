import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import {
  confirmEmailVerification,
  getCurrentAuthUser,
} from "@/features/auth/services/auth.service";
import { toUserMessage } from "@/lib/errors/app-error";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/app/SiteFooter";
import { PublicHeader } from "@/components/app/PublicHeader";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirm your Memskool email" },
      {
        name: "description",
        content: "Confirm your Memskool email address so we can recover your account if needed.",
      },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oobCode = params.get("oobCode");
    if (!oobCode) {
      setStatus("error");
      setMessage("Open the confirmation link from your email to continue.");
      return;
    }
    void confirmEmailVerification(oobCode)
      .then(async () => {
        setStatus("done");
        setMessage("Email confirmed. You can continue to Memskool.");
        toast.success("Email confirmed.");
        const user = await getCurrentAuthUser();
        navigate({ to: user ? "/dashboard" : "/auth", replace: true });
      })
      .catch((error: unknown) => {
        setStatus("error");
        setMessage(toUserMessage(error));
      });
  }, [navigate]);

  return (
    <div className="canvas-mesh flex min-h-screen flex-col">
      <PublicHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <span className="brand-gradient brand-shadow mx-auto mb-4 flex size-14 items-center justify-center rounded-3xl">
            <GraduationCap className="size-7" />
          </span>
          <h1 className="brand-text font-display text-3xl font-semibold tracking-tight">
            Confirm your email
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          {status !== "working" ? (
            <Button asChild className="mt-6 rounded-full">
              <Link to={status === "done" ? "/dashboard" : "/auth"}>
                {status === "done" ? "Continue" : "Back to sign in"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
