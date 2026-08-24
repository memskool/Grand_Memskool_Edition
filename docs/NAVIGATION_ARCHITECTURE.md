# Navigation architecture

Navigation is data-driven from `src/lib/nav.ts`.

```text
AppRole
  → navForRole(role, examActive, pendingApproval)
  → AppSidebar (desktop) / MobileNav (tabs + overflow menu)
  → canAccessRoute for RouteGuard
```

Do not add one-off hidden links that bypass `navForRole`. If a URL is not in that list for the role, `RouteGuard` shows “Not part of your workspace”.

## Layouts

- Desktop (`md+`): collapsible sidebar, sticky header (theme, notifications, user menu).
- Mobile: four primary tabs from `mobileTabsForRole` plus a Menu sheet for the rest. Bottom bar uses safe-area padding.

Exam mode still hides AI Tutor. Pending teachers keep `PENDING_ALLOWED` only.

## User menu

Settings and Sign out. Avatar uses `avatar_url` when present.

## Future features

Existing locker / assessments / classroom screens remain in nav for the roles that already had them. They show real empty states when Firestore has no rows. Superadmin does not receive those school-product links.
