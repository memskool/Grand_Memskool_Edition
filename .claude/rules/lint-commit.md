---
paths:
  - "src/**/*.{ts,tsx,js,jsx,mjs,cjs}"
  - "firestore.rules"
  - "storage.rules"
---

# Lint & git (Memskool)

- Before every commit: `npx eslint --fix` on touched JS/TS files (CI fails on Prettier).
- No force-push / rebase-amend of already-pushed commits (Lovable history).
- Do not commit `.env`, service-account JSON, or secrets.
- Prefer small focused commits; push only when the user asks or the task explicitly requires shipping.
