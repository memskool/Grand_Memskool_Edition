import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteFooter } from "@/components/app/SiteFooter";

export const Route = createFileRoute("/auth")({
  // Auth state only exists in the browser; rendering this shell on the server
  // produced a hydration mismatch.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in to Memskool — eSchool platform" },
      {
        name: "description",
        content:
          "Sign in or create your Memskool account as a student, teacher, parent or admin to access classes, assignments and your locker.",
      },
      { property: "og:title", content: "Sign in to Memskool" },
      {
        property: "og:description",
        content:
          "Access the Memskool digital education ecosystem for students, teachers and parents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const ACCOUNT_TYPES = [
  {
    value: "student",
    label: "Student",
    blurb: "Classes, locker, library, AI tutor, Dream School and the book store.",
  },
  {
    value: "parent",
    label: "Parent",
    blurb: "Follow attendance, performance and school communication for your child.",
  },
  {
    value: "teacher",
    label: "Teacher",
    blurb: "Request to join your school, then teach, grade and run live classes.",
  },
  {
    value: "institution",
    label: "School / Institution",
    blurb: "Register your school, upload students and teachers, publish books.",
  },
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];


/** Turns raw Supabase auth errors into guidance a learner or parent can act on. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match an account. Check them, or create an account first.";
  if (m.includes("email not confirmed"))
    return "Your email isn't confirmed yet. Open the confirmation link we emailed you, or resend it below.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with that email already exists. Try signing in instead.";
  if (m.includes("password should be at least")) return "Passwords must be at least 6 characters.";
  if (m.includes("rate limit") || m.includes("after"))
    return "Too many attempts just now. Please wait a moment and try again.";
  return message;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AccountType>("student");
  const [schoolCode, setSchoolCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [foundSchool, setFoundSchool] = useState<SchoolSummary | null>(null);
  const [checkingSchool, setCheckingSchool] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");

  const needsSchoolCode = role === "student" || role === "teacher";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // Live School-ID verification while typing.
  useEffect(() => {
    if (!needsSchoolCode || schoolCode.trim().length < 3) {
      setFoundSchool(null);
      return;
    }
    let cancelled = false;
    setCheckingSchool(true);
    const timer = setTimeout(() => {
      lookupSchool(schoolCode)
        .then((s) => {
          if (!cancelled) setFoundSchool(s);
        })
        .catch(() => {
          if (!cancelled) setFoundSchool(null);
        })
        .finally(() => {
          if (!cancelled) setCheckingSchool(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [schoolCode, needsSchoolCode]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) setAwaitingConfirm(true);
      toast.error(friendlyAuthError(error.message));
      return;
    }
    if (data.session) navigate({ to: "/dashboard", replace: true });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Passwords must be at least 6 characters.");
      return;
    }
    if (needsSchoolCode && !foundSchool) {
      toast.error("That School ID isn't on Memskool yet. Check it with your school.");
      return;
    }
    if (role === "student" && !studentCode.trim()) {
      toast.error("Enter the student ID your school gave you.");
      return;
    }
    if (role === "institution" && !schoolName.trim()) {
      toast.error("Enter your school's name.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName.trim(),
          role,
          school_code: needsSchoolCode ? schoolCode.trim() : null,
          student_code: role === "student" ? studentCode.trim() : null,
          school_name: role === "institution" ? schoolName.trim() : null,
        },
      },
    });

    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      toast.error("An account with that email already exists. Try signing in instead.");
      return;
    }
    setAwaitingConfirm(true);
    toast.success("Account created. Check your email to confirm, then sign in.");
  };

  const resendConfirmation = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    toast.success("Confirmation email sent again.");
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    toast.success("Password reset link sent. Check your inbox.");
    setMode("signin");
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="surface-gradient relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70 blur-3xl"
        style={{ background: "var(--gradient-brand)", opacity: 0.18 }}
      />
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="brand-gradient brand-shadow mb-4 flex size-14 items-center justify-center rounded-3xl">
              <GraduationCap className="size-7" />
            </span>
            <h1 className="brand-text font-display text-4xl font-semibold tracking-tight">
              Memskool
            </h1>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              One account for your classes, work and school life.
            </p>
          </div>

          <div className="surface-card p-6">
            {mode === "forgot" ? (
              <form onSubmit={sendReset} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-semibold tracking-tight">
                    Reset your password
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We'll email you a secure link to choose a new password.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full rounded-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-full"
                  onClick={() => setMode("signin")}
                >
                  Back to sign in
                </Button>
              </form>
            ) : (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2 rounded-full">
                  <TabsTrigger value="signin" className="rounded-full">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-full">
                    Create account
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-6">
                  <form onSubmit={signIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="si-email">Email</Label>
                      <Input
                        id="si-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="si-pass">Password</Label>
                      <Input
                        id="si-pass"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full rounded-full" disabled={loading}>
                      {loading ? "Signing in…" : "Sign in"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                    >
                      Forgot your password?
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={signUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="su-name">Full name</Label>
                      <Input
                        id="su-name"
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-email">Email</Label>
                      <Input
                        id="su-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-pass">Password</Label>
                      <Input
                        id="su-pass"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>I am a</Label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full rounded-full" disabled={loading}>
                      {loading ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}

            {awaitingConfirm && mode === "signin" ? (
              <div className="mt-5 rounded-2xl border border-border/70 bg-muted/40 p-4 text-xs text-muted-foreground">
                <p>
                  We sent a confirmation link to <span className="font-medium">{email}</span>.
                  Confirm it, then sign in.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 rounded-full px-3 text-xs"
                  onClick={resendConfirmation}
                  disabled={loading}
                >
                  Resend confirmation email
                </Button>
              </div>
            ) : null}

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              OR
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full rounded-full" onClick={google}>
              Continue with Google
            </Button>
          </div>
        </div>
      </div>
      <SiteFooter className="relative" />
    </div>
  );
}
