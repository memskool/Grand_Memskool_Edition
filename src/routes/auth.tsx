import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrandMark } from "@/components/app/BrandMark";
import { toast } from "sonner";
import {
  signInEmail,
  signUpEmail,
  requestPasswordReset,
  resendVerification,
  signInWithGoogle,
  completeGoogleRedirect,
  getCurrentAuthUser,
  refreshAuthClaims,
} from "@/features/auth/services/auth.service";
import { completeSignup } from "@/features/auth/services/complete-signup.functions";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { ACCOUNT_TYPES, type AccountType } from "@/features/auth/account-types";
import { parseAuthSearch, safeAppPath } from "@/lib/safe-redirect";
import { COLLECTIONS, getById } from "@/lib/firebase/repo";
import type { UserProfile } from "@/types/user";
import { isProfileComplete } from "@/features/auth/account-state";
import {
  saveSignupIntent,
  clearSignupIntent,
  type SignupIntent,
} from "@/features/auth/signup-intent";
import { resolveAfterGoogleSignIn } from "@/features/auth/google-session";
import { GoogleSignInButton } from "@/components/app/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteFooter } from "@/components/app/SiteFooter";
import { lookupSchool, type SchoolSummary } from "@/lib/school-membership";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: parseAuthSearch,
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

/** Turns raw auth errors into guidance a learner or parent can act on. */
function friendlyAuthError(error: unknown): string {
  return authErrorMessage(error);
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const continueTo = safeAppPath(redirectTo) ?? "/dashboard";
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
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [bootstrapping, setBootstrapping] = useState(true);
  const submitting = useRef(false);

  const needsSchoolCode = role === "student" || role === "teacher";

  const currentIntent = (): SignupIntent => ({
    role,
    fullName,
    schoolCode,
    studentCode,
    schoolName,
  });

  const finishGoogle = async (user: Awaited<ReturnType<typeof signInWithGoogle>>) => {
    if (user === "redirecting") return;
    const result = await resolveAfterGoogleSignIn(user, continueTo);
    if (result.notice) toast.error(result.notice);
    navigate({ to: result.to, replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const redirected = await completeGoogleRedirect();
        if (cancelled) return;
        if (redirected) {
          setLoading(true);
          await finishGoogle(redirected);
          return;
        }
      } catch (error) {
        if (!cancelled) toast.error(friendlyAuthError(error));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount to finish Google redirect sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || bootstrapping) return;
    void getCurrentAuthUser().then(async (user) => {
      if (!user) return;
      let profile: UserProfile | null = null;
      try {
        profile = await getById<UserProfile>(COLLECTIONS.users, user.id);
      } catch {
        profile = null;
      }
      navigate({ to: isProfileComplete(profile) ? continueTo : "/onboarding", replace: true });
    });
  }, [navigate, continueTo, loading, bootstrapping]);

  // Live School-ID verification while typing.
  useEffect(() => {
    if ((!needsSchoolCode && role !== "institution") || schoolCode.trim().length < 3) {
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
  }, [schoolCode, needsSchoolCode, role]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInEmail(email.trim(), password);
      const user = await getCurrentAuthUser();
      let profile: UserProfile | null = null;
      try {
        profile = user ? await getById<UserProfile>(COLLECTIONS.users, user.id) : null;
      } catch {
        // Auth succeeded; a missing/unreadable profile still belongs on onboarding.
        profile = null;
      }
      navigate({ to: isProfileComplete(profile) ? continueTo : "/onboarding", replace: true });
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
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
    const wantedCode = schoolCode.trim().toUpperCase();
    if (role === "institution" && wantedCode) {
      if (!/^[A-Z0-9-]{3,24}$/.test(wantedCode)) {
        toast.error("School ID must be 3–24 letters, numbers or dashes.");
        return;
      }
      if (foundSchool) {
        toast.error("That School ID is already taken. Pick another one.");
        return;
      }
    }
    setLoading(true);
    submitting.current = true;
    try {
      const { needsEmailConfirm } = await signUpEmail(email.trim(), password);
      await refreshAuthClaims();
      await completeSignup({
        data: {
          full_name: fullName.trim(),
          role,
          school_code: needsSchoolCode
            ? schoolCode.trim()
            : role === "institution" && wantedCode
              ? wantedCode
              : null,
          student_code: role === "student" ? studentCode.trim() : null,
          school_name: role === "institution" ? schoolName.trim() : null,
        },
      });
      await refreshAuthClaims();
      if (needsEmailConfirm) {
        try {
          await resendVerification();
        } catch {
          // Account exists; the dashboard banner can resend.
        }
        setAwaitingConfirm(true);
        toast.success(
          role === "teacher"
            ? "Account created. Confirm the email from notifications@memskool.com — your school still needs to approve your request."
            : "Account created. Check notifications@memskool.com in your inbox (and spam), then continue.",
        );
      }
      navigate({ to: continueTo, replace: true });
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    setLoading(true);
    try {
      await resendVerification();
      toast.success("Sent from notifications@memskool.com — check spam if it is not in the inbox.");
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      toast.success(
        "If that account exists, we sent a reset link from notifications@memskool.com.",
      );
      setMode("signin");
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    if (tab === "signup") {
      saveSignupIntent(currentIntent());
    } else {
      clearSignupIntent();
    }
    let redirected = false;
    setLoading(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn === "redirecting") {
        redirected = true;
        toast.message("Taking you to Google to finish signing in…");
        return;
      }
      await finishGoogle(signedIn);
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      if (!redirected) setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandMark size={64} className="mb-4" priority />
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              Memskool Institute
            </p>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
              Welcome to Memskool
            </h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Classes, live lessons, assessments and a private AI tutor — in one school workspace.
              Use the School ID your institution gave you when you create an account.
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
              <Tabs
                value={tab}
                onValueChange={(value) => setTab(value === "signup" ? "signup" : "signin")}
              >
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
                      <Label>I am joining as</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {ACCOUNT_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              setRole(t.value);
                              setSchoolCode("");
                              setFoundSchool(null);
                              setStudentCode("");
                            }}
                            aria-pressed={role === t.value}
                            className={`rounded-2xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                              role === t.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/70 text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ACCOUNT_TYPES.find((t) => t.value === role)?.blurb}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="su-name">
                        {role === "institution" ? "Contact person's name" : "Full name"}
                      </Label>
                      <Input
                        id="su-name"
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>

                    {role === "institution" ? (
                      <div className="space-y-2">
                        <Label htmlFor="su-school-name">School name</Label>
                        <Input
                          id="su-school-name"
                          required
                          placeholder="e.g. Kampala Modern High School"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                        />
                      </div>
                    ) : null}

                    {role === "institution" ? (
                      <div className="space-y-2">
                        <Label htmlFor="su-own-code">School ID (optional)</Label>
                        <Input
                          id="su-own-code"
                          placeholder="e.g. KMHS-2026"
                          value={schoolCode}
                          onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                        />
                        <p
                          className={`text-xs ${foundSchool ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {checkingSchool
                            ? "Checking availability…"
                            : foundSchool
                              ? "That School ID is already taken — pick another."
                              : "Pick your own ID (3–24 letters, numbers or dashes), or leave blank and we'll generate one. You can change it later."}
                        </p>
                      </div>
                    ) : null}

                    {needsSchoolCode ? (
                      <div className="space-y-2">
                        <Label htmlFor="su-school-code">School ID</Label>
                        <Input
                          id="su-school-code"
                          required
                          placeholder="e.g. MS-4F91A2"
                          value={schoolCode}
                          onChange={(e) => setSchoolCode(e.target.value)}
                        />
                        <p
                          className={`text-xs ${foundSchool ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {checkingSchool
                            ? "Checking School ID…"
                            : foundSchool
                              ? `Matched ${foundSchool.name}${foundSchool.city ? ` · ${foundSchool.city}` : ""}`
                              : "Enter the School ID your school gave you."}
                        </p>
                      </div>
                    ) : null}

                    {role === "student" ? (
                      <div className="space-y-2">
                        <Label htmlFor="su-student-code">Student ID</Label>
                        <Input
                          id="su-student-code"
                          required
                          placeholder="e.g. STU-2026-0142"
                          value={studentCode}
                          onChange={(e) => setStudentCode(e.target.value)}
                        />
                      </div>
                    ) : null}

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
                      <p className="text-xs text-muted-foreground">
                        At least 6 characters. You can change it any time in Settings.
                      </p>
                    </div>

                    {role === "teacher" ? (
                      <p className="rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
                        Your school approves teacher accounts. Until then you can sign in, but
                        teaching tools stay locked.
                      </p>
                    ) : null}

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

            {mode !== "forgot" ? (
              <>
                <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  OR
                  <span className="h-px flex-1 bg-border" />
                </div>
                <GoogleSignInButton
                  loading={loading || bootstrapping}
                  onClick={() => void google()}
                />
              </>
            ) : null}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <a href="/terms" className="underline-offset-2 hover:underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline-offset-2 hover:underline">
                Privacy
              </a>{" "}
              notices.
            </p>
          </div>
        </div>
      </div>
      <SiteFooter className="relative" />
    </div>
  );
}
