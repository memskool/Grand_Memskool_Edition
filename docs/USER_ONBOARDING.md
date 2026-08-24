# User onboarding

Onboarding recovers interrupted signup and Google-first accounts.

```text
Authenticated
  → load users/{uid}
  → missing / incomplete → /onboarding
  → complete → authorized dashboard
```

`/onboarding` is outside `AppShell`. Closing the browser is safe: Auth persists; the next visit hits IdentityGate and returns here until `completeSignup` succeeds.

The form reuses the same fields as create-account: name, role, school ID / school name / student ID. It cannot assign `superadmin` or `admin`.

IdentityGate in `AppShell` blocks the workspace until `isProfileComplete`. Signed-in visits to `/auth` also bounce incomplete profiles to `/onboarding`.
