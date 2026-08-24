# Responsive strategy

The existing Memskool visual language is kept. Layout adapts by region, not by cloning the product.

| Region | Behavior |
| --- | --- |
| Header | Sticky; brand label hidden on the smallest widths; controls stay in a single row |
| Main | `max-w-6xl`, extra bottom padding on small screens so content clears the tab bar |
| Sidebar | Desktop only (`SidebarProvider`) |
| Mobile nav | `md:hidden` tab bar + full-screen menu; 32px icon targets |
| Auth / onboarding | Centered `max-w-md` card; role chips `min-h-11` |
| Dashboards | Existing `sm:` / `lg:` grids |

Skip-to-content is available for keyboard users.

## PWA

`public/manifest.webmanifest` + favicon icon, linked from the root head. No service worker: Auth, Firestore, and live classroom need the network. Full offline belongs to a later phase.

## What was not claimed

No device lab run. Layouts were reviewed against the existing Tailwind breakpoints (mobile tab bar vs desktop sidebar, auth card, dashboard grids). A production `vite build` is the compile check, not a substitute for browser QA on physical phones.
