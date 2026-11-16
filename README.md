# Memskool

A school platform for Uganda: multi-tenant schools, live classes, assessments, Gold tutoring, Home video, messaging, and an AI tutor.

Production: [memskool.com](https://memskool.com) (Vercel) · Firebase project `memskool-4e193` · Firestore Enterprise database `default` in `africa-south1`.

## Stack

- **App:** TanStack Start + React 19 + Vite, TanStack Router/Query, Tailwind 4, shadcn/Radix UI
- **Auth & data:** Firebase Auth (custom claims `role`, `schoolId`, `approved`) + Cloud Firestore; server functions use the Admin SDK
- **Live video:** LiveKit (server-minted tokens, webhook-driven presence)
- **Payments:** Flutterwave · **AI tutor:** Crane5 (both need credentials)

## Getting started

Requires Node `>=22.12`.

```sh
npm install
cp .env.example .env   # then fill in Firebase / LiveKit / other keys
npm run dev
```

## Commands

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Local dev server                           |
| `npm run typecheck` | TypeScript check                           |
| `npm run test`      | Unit tests (pure policy/predicate checks)  |
| `npm run lint`      | ESLint + Prettier (CI fails on formatting) |
| `npm run build`     | Production build (Vercel preset)           |

Run `npx eslint --fix <touched files>` before every commit.

## Layout

| Path                               | Contents                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/features/*`                   | Domain modules: academic, live-classroom, assessment, gold, home, ai-tutor, auth           |
| `src/lib/*`                        | Shared client/server libraries (Firebase, nav policy, data hooks, payments, notifications) |
| `src/routes/*`                     | File-based routes, including `/api/public/*` webhooks                                      |
| `functions/`                       | Cloud Functions (not deployed while the project is on the Spark plan)                      |
| `firestore.rules`, `storage.rules` | Security rules                                                                             |
| `docs/`                            | Architecture, product decisions, QA matrix                                                 |

## Further reading

- [CLAUDE.md](CLAUDE.md) — architecture rules for contributors and agents
- [docs/PRODUCT_DECISIONS.md](docs/PRODUCT_DECISIONS.md)
- [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md)
- [docs/qa/phase10-matrix.md](docs/qa/phase10-matrix.md)

## Lovable

This repository is connected to [Lovable](https://lovable.dev/projects/4b439e00-05c5-4bfd-a8e9-8d6922926738). Changes pushed to `main` sync back to the editor — never force-push or rewrite published history.
