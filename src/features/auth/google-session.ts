import { COLLECTIONS, getById } from "@/lib/firebase/repo";
import { lookupSchool } from "@/lib/school-membership";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import type { UserProfile } from "@/types/user";
import type { AuthUser } from "@/types/roles";
import { isProfileComplete } from "@/features/auth/account-state";
import { completeSignup } from "@/features/auth/services/complete-signup.functions";
import { refreshAuthClaims } from "@/features/auth/services/auth.service";
import { loadMyAccount } from "@/features/auth/services/session-account.functions";
import {
  clearSignupIntent,
  loadSignupIntent,
  signupIntentError,
  signupPayload,
} from "@/features/auth/signup-intent";
import { workspaceHome } from "@/features/auth/account-types";

function unwrapProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["full_name"] === "string" && typeof obj["role"] === "string") {
    return raw as UserProfile;
  }
  for (const key of ["data", "result", "payload", "value"]) {
    const inner = obj[key];
    if (inner && typeof inner === "object") {
      const nested = unwrapProfile(inner);
      if (nested) return nested;
    }
  }
  return null;
}

export async function resolveAfterGoogleSignIn(
  user: AuthUser,
  continueTo?: string | null,
): Promise<{ to: string; notice?: string }> {
  let profile: UserProfile | null = null;
  try {
    profile = unwrapProfile(await loadMyAccount());
  } catch {
    profile = null;
  }
  if (!profile) {
    try {
      profile = await getById<UserProfile>(COLLECTIONS.users, user.id);
    } catch {
      profile = null;
    }
  }

  if (isProfileComplete(profile)) {
    clearSignupIntent();
    await refreshAuthClaims().catch(() => undefined);
    return { to: continueTo ?? workspaceHome(profile?.role) };
  }

  const intent = loadSignupIntent();
  if (!intent || signupIntentError(intent)) {
    return { to: "/onboarding" };
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
    return { to: continueTo ?? workspaceHome(intent.role) };
  } catch (error) {
    return { to: "/onboarding", notice: authErrorMessage(error) };
  }
}
