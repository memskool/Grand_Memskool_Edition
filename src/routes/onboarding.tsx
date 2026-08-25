import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrandMark } from "@/components/app/BrandMark";
import { SiteFooter } from "@/components/app/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeSignup } from "@/features/auth/services/complete-signup.functions";
import {
  getCurrentAuthUser,
  refreshAuthClaims,
  signOut,
} from "@/features/auth/services/auth.service";
import { ACCOUNT_TYPES, type AccountType } from "@/features/auth/account-types";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { lookupSchool, type SchoolSummary } from "@/lib/school-membership";
import { COLLECTIONS, getById } from "@/lib/firebase/repo";
import type { UserProfile } from "@/types/user";
import { isProfileComplete } from "@/features/auth/account-state";
import { clearSignupIntent, loadSignupIntent } from "@/features/auth/signup-intent";
import { seedSessionAfterSignup, unwrapSignupResult } from "@/features/auth/seed-session";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finish your Memskool account" },
      {
        name: "description",
        content: "Complete your Memskool profile so we can open the right workspace for you.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AccountType>("student");
  const [schoolCode, setSchoolCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [foundSchool, setFoundSchool] = useState<SchoolSummary | null>(null);
  const [checkingSchool, setCheckingSchool] = useState(false);

  const needsSchoolCode = role === "student" || role === "teacher";

  useEffect(() => {
    void (async () => {
      const user = await getCurrentAuthUser();
      if (!user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      let profile: UserProfile | null = null;
      try {
        profile = await getById<UserProfile>(COLLECTIONS.users, user.id);
      } catch {
        profile = null;
      }
      if (isProfileComplete(profile)) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      const intent = loadSignupIntent();
      if (intent) {
        setRole(intent.role);
        setFullName(intent.fullName.trim() || user.displayName || "");
        setSchoolCode(intent.schoolCode);
        setStudentCode(intent.studentCode);
        setSchoolName(intent.schoolName);
      } else {
        setFullName(user.displayName ?? "");
      }
      setReady(true);
    })();
  }, [navigate]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    try {
      await refreshAuthClaims();
      const saved = unwrapSignupResult(
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
        }),
        {
          role,
          schoolId: null,
          membership:
            role === "teacher" ? "pending" : role === "institution" ? "owner" : "approved",
        },
      );
      await refreshAuthClaims();
      const user = await getCurrentAuthUser();
      if (user) {
        seedSessionAfterSignup(queryClient, {
          userId: user.id,
          email: user.email,
          fullName: fullName.trim(),
          role: saved.role,
          schoolId: saved.schoolId,
          membership: saved.membership,
          studentCode: role === "student" ? studentCode.trim() : null,
        });
      }
      clearSignupIntent();
      toast.success(
        role === "teacher"
          ? "Profile saved. Your school still needs to approve your teacher account."
          : "Profile saved. Welcome to Memskool.",
      );
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Checking your account…
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandMark size={64} className="mb-4" />
            <h1 className="font-display text-3xl font-bold tracking-tight">Finish setting up</h1>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Tell us who you are so we can open the right Memskool workspace. You can close this
              page and come back — nothing is lost.
            </p>
          </div>
          <form onSubmit={submit} className="surface-card space-y-4 p-6">
            <div className="space-y-2">
              <Label>I am joining as</Label>
              <div className="grid grid-cols-2 gap-2">
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setRole(t.value)}
                    aria-pressed={role === t.value}
                    className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
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
              <Label htmlFor="ob-name">
                {role === "institution" ? "Contact person's name" : "Full name"}
              </Label>
              <Input
                id="ob-name"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            {role === "institution" ? (
              <div className="space-y-2">
                <Label htmlFor="ob-school-name">School name</Label>
                <Input
                  id="ob-school-name"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                />
              </div>
            ) : null}
            {role === "institution" ? (
              <div className="space-y-2">
                <Label htmlFor="ob-own-code">School ID (optional)</Label>
                <Input
                  id="ob-own-code"
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
                      : "Pick your own ID, or leave blank and we'll generate one."}
                </p>
              </div>
            ) : null}
            {needsSchoolCode ? (
              <div className="space-y-2">
                <Label htmlFor="ob-school-code">School ID</Label>
                <Input
                  id="ob-school-code"
                  required
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                />
                <p className={`text-xs ${foundSchool ? "text-primary" : "text-muted-foreground"}`}>
                  {checkingSchool
                    ? "Checking School ID…"
                    : foundSchool
                      ? `Matched ${foundSchool.name}`
                      : "Enter the School ID your school gave you."}
                </p>
              </div>
            ) : null}
            {role === "student" ? (
              <div className="space-y-2">
                <Label htmlFor="ob-student-code">Student ID</Label>
                <Input
                  id="ob-student-code"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                />
              </div>
            ) : null}
            {role === "teacher" ? (
              <p className="rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
                Your school approves teacher accounts. Until then you can sign in, but teaching
                tools stay locked.
              </p>
            ) : null}
            <Button type="submit" className="w-full rounded-full" disabled={loading}>
              {loading ? "Saving…" : "Continue"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-full"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
      <SiteFooter className="relative" />
    </div>
  );
}
