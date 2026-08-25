import { COLLECTIONS, getById } from "@/lib/firebase/repo";
import { lookupSchool } from "@/lib/school-membership";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import type { UserProfile } from "@/types/user";
import type { AuthUser } from "@/types/roles";
import { isProfileComplete } from "@/features/auth/account-state";
import { completeSignup } from "@/features/auth/services/complete-signup.functions";
import { refreshAuthClaims } from "@/features/auth/services/auth.service";
import {
  clearSignupIntent,
  loadSignupIntent,
  signupIntentError,
  signupPayload,
} from "@/features/auth/signup-intent";

export async function resolveAfterGoogleSignIn(
  user: AuthUser,
  continueTo: string,
): Promise<{ to: string; notice?: string }> {
  let profile: UserProfile | null = null;
  try {
    profile = await getById<UserProfile>(COLLECTIONS.users, user.id);
  } catch {
    profile = null;
  }

  if (isProfileComplete(profile)) {
    clearSignupIntent();
    return { to: continueTo };
  }

  const intent = loadSignupIntent();
  if (!intent || signupIntentError(intent)) {
    return { to: "/onboarding" };
  }

  if (intent.role === "student" || intent.role === "teacher") {
    const school = await lookupSchool(intent.schoolCode);
    if (!school) return { to: "/onboarding" };
  }

  if (intent.role === "institution") {
    const wanted = intent.schoolCode.trim().toUpperCase();
    if (wanted) {
      const taken = await lookupSchool(wanted);
      if (taken) return { to: "/onboarding" };
    }
  }

  try {
    await refreshAuthClaims();
    await completeSignup({ data: signupPayload(intent) });
    await refreshAuthClaims();
    clearSignupIntent();
    return { to: continueTo };
  } catch (error) {
    return { to: "/onboarding", notice: authErrorMessage(error) };
  }
}
