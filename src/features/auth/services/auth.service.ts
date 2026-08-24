import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  confirmPasswordReset,
  verifyPasswordResetCode,
  applyActionCode,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { hasFirebaseWebConfig } from "@/lib/firebase/config";
import { AppError, classifyFirebase } from "@/lib/errors/app-error";
import type { AuthUser } from "@/types/roles";

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
  };
}

export function subscribeAuth(cb: (user: AuthUser | null) => void): () => void {
  if (!hasFirebaseWebConfig()) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    cb(user ? toAuthUser(user) : null);
  });
}

export async function reloadAuthUser(): Promise<AuthUser | null> {
  if (!hasFirebaseWebConfig()) return null;
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  return toAuthUser(user);
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  if (!hasFirebaseWebConfig()) return null;
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  return auth.currentUser ? toAuthUser(auth.currentUser) : null;
}

export async function refreshAuthClaims(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  await user.getIdToken(true);
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function signInEmail(email: string, password: string): Promise<AuthUser> {
  try {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return toAuthUser(cred.user);
  } catch (error) {
    throw classifyFirebase(error);
  }
}

export async function signUpEmail(
  email: string,
  password: string,
): Promise<{ user: AuthUser; needsEmailConfirm: boolean }> {
  try {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    return { user: toAuthUser(cred.user), needsEmailConfirm: !cred.user.emailVerified };
  } catch (error) {
    throw classifyFirebase(error);
  }
}

export async function signInWithGoogle(): Promise<AuthUser> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(getFirebaseAuth(), provider);
    return toAuthUser(cred.user);
  } catch (error) {
    throw classifyFirebase(error);
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { sendPasswordResetMail } = await import("./mail.functions");
  await sendPasswordResetMail({
    data: { email, origin: window.location.origin },
  });
}

export async function completePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  try {
    await verifyPasswordResetCode(getFirebaseAuth(), oobCode);
    await confirmPasswordReset(getFirebaseAuth(), oobCode, newPassword);
  } catch (error) {
    throw classifyFirebase(error);
  }
}

export async function changePassword(newPassword: string): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AppError("auth", "You need to be signed in to change your password.");
  try {
    await updatePassword(user, newPassword);
  } catch (error) {
    throw classifyFirebase(error);
  }
}

export async function resendVerification(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user)
    throw new AppError("auth", "Sign in first, then we can resend the confirmation email.");
  const { sendVerificationEmail } = await import("./mail.functions");
  await sendVerificationEmail({
    data: { origin: window.location.origin },
  });
}

export async function confirmEmailVerification(oobCode: string): Promise<void> {
  try {
    await applyActionCode(getFirebaseAuth(), oobCode);
    const user = getFirebaseAuth().currentUser;
    if (user) await user.reload();
  } catch (error) {
    throw classifyFirebase(error);
  }
}
