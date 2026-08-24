# Authentication flow

Implemented in `src/routes/auth.tsx`, `src/routes/onboarding.tsx`, `src/routes/reset-password.tsx`, and `src/features/auth/services/auth.service.ts`.

## Sign up (email)

1. Create Firebase Auth user.
2. Best-effort verification email.
3. `completeSignup` (Admin SDK) writes claims, `users/{uid}`, school / membership as required.
4. Client calls `refreshAuthClaims()` (`getIdToken(true)`) so nav sees the new role immediately.
5. Continue to the intended app path (`?redirect=` when safe) or `/dashboard`.

Roles offered: student, parent, teacher, institution. Superadmin cannot be self-assigned.

## Sign in (email)

Firebase `signInWithEmailAndPassword`. If `users/{uid}` is incomplete, go to `/onboarding`. Otherwise restore `redirect` or `/dashboard`.

## Google

Popup sign-in. Existing profiles continue. New Google users have Auth but no Memskool profile — they are sent to `/onboarding` to pick a non-privileged role and school relationship.

## Password reset

`/auth` forgot mode sends `sendPasswordResetEmail` with continue URL `/reset-password`. That page reads `oobCode` and calls `confirmPasswordReset`.

## Sign out

Clears React Query, `signOut()`, replace-navigate to `/auth`.

## Session restore

`getCurrentAuthUser` waits for `auth.authStateReady()`. `_authenticated` `beforeLoad` redirects to `/auth?redirect=<path>` when there is no user. `attachFirebaseAuth` also waits for `authStateReady` before attaching the ID token.

## Errors

`src/lib/errors/auth-errors.ts` plus `toUserMessage` / `mapFirebaseMessage`. Raw codes such as `auth/invalid-credential` become “The email or password is incorrect.” `permission-denied` becomes “You do not have permission to perform this action.” Server `Error` messages that are already written for people (signup validation) are passed through.
