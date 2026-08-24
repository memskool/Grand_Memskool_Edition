# Identity architecture

Memskool identity is layered. The browser never becomes the security authority.

```text
Firebase Auth (UID, email, emailVerified)
        ↓
Custom claims (role, schoolId, approved) — Admin SDK only
        ↓
users/{uid} profile (display fields, membership_status)
        ↓
school_members / schools (tenant membership)
        ↓
UI: AuthProvider → useAccess → nav + RouteGuard + IdentityGate
        ↓
Server functions + Firestore rules (real authorization)
```

## Sources of truth

| Concern | Source |
| --- | --- |
| Is someone signed in? | Firebase Auth session (`AuthProvider`) |
| Privileged role / school / teacher approval | Custom claims |
| Display name, phone, avatar, stored role | `users/{uid}` |
| School membership row | `school_members` |
| UI workspace | `claimsRoleToAppRole` then `src/lib/nav.ts` |

Claim `admin` maps to the **institution** workspace. Users cannot write `role`, `school_id`, or `superadmin` from the client (`firestore.rules` `hasOnly` on profile updates). Signup roles are `student | teacher | parent | institution` only.

## Account states (derived)

| State | Meaning |
| --- | --- |
| `incomplete` | Auth user exists, `users/{uid}` missing or incomplete |
| `pending` | Teacher waiting for school approval |
| `suspended` | Active disciplinary suspension |
| `active` | Profile complete and allowed to use their workspace |

These are derived in `src/features/auth/account-state.ts`, not a separate writable enum on every document. `membership_status` on the user doc still records pending / approved / rejected / owner.

## Session

A single `AuthProvider` in the root route owns `onAuthStateChanged`. `useSession()` reads that context. Firestore data stays in React Query. Theme stays in `ThemeProvider` + `localStorage`. No Zustand store.

## Avatars

Uploaded to Storage `avatars/{uid}/profile`. The download URL is stored on `users.avatar_url`. Rules allow the owner to write that field only with `full_name`, `phone`, and `updated_at`.
