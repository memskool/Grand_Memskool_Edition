# Design system

Memskool uses one visual language: monochrome Inter, generous radius, calm surfaces. Tokens live in `src/styles.css`. Shared layout primitives live in `src/components/app/primitives.tsx`. Controls come from `src/components/ui/*` (shadcn/Radix) with **rounded-full** buttons.

## Tokens

| Token | Light | Role |
| --- | --- | --- |
| `--background` | oklch(0.985 0.002 90) | Page |
| `--foreground` | oklch(0.18 0 0) | Text |
| `--primary` | black / white in dark | Primary actions |
| `--muted-foreground` | grey | Secondary copy |
| `--destructive` | red | Errors / danger |
| `--radius` | 1rem | Cards; buttons use full pills |
| `--font-sans` / `--font-display` | Inter | UI and headings |
| `--shadow-soft` | 0 4px 24px rgb(0 0 0 / 0.06) | Cards |
| `--gradient-brand` | black → charcoal | PageHeader accent bar |

Dark mode inverts the same scale (`.dark`). Charts use `--chart-1` … `--chart-5` greyscale.

## Typography

- Page title: `font-display text-2xl sm:text-3xl` (`PageHeader`)
- Section title: `font-display text-base font-semibold` (`Panel`)
- Body: `text-sm`
- Hints: `text-xs text-muted-foreground`

## Spacing

Page canvas: `max-w-6xl`, `px-4 py-6 sm:px-6 sm:py-8`, extra bottom padding on mobile for the tab bar (`pb-24 md:pb-8`).

Stacks: `space-y-6` between sections, `gap-4` in stat grids, `rounded-xl` inner rows, `rounded-2xl` banners, `rounded-3xl` class cards.

## Component patterns

- **PageHeader** — gradient bar, title, subtitle, optional action.
- **Panel** — `surface-card` section with title/description.
- **StatCard** — icon + metric.
- **EmptyState** — dashed border, icon, title, hint, optional action.
- **ListSkeleton** — loading placeholder.
- **Toasts** — Sonner; user copy via `authErrorMessage` / `toUserMessage`.
- **Tabs** — often `rounded-full` triggers; school admin tab list wraps (`flex-wrap`).

Do not invent a second card style. Prefer `surface-card` / `Panel`.

## Interaction

Primary action: filled pill button. Secondary: outline pill. Destructive: confirm with copy that names the consequence (archive class, unlink family). After success: toast + query invalidation.

## Responsive

Mobile bottom nav: first four items from `navForRole`. Touch targets: button `h-9` / `h-8` sm, class cards `min-h-[148px]`. Tables and charts sit in horizontally safe panels; exam runner is a dedicated route.

## Accessibility

Skip link to `#main`. Sticky header. `noindex` on authenticated routes. Exam timer should remain readable. Charts are supporting, not the only way to read a score (lists remain). Offline: `NetworkBanner` with `role="status"`.
