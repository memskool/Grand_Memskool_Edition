<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Lint before every commit/push

CI runs `npm run lint` (`eslint .`) and **fails on Prettier formatting errors**.

Before any `git commit` (and before pushing new commits):

1. Identify every staged/touched source file (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`).
2. Run `npx eslint --fix <those files>` (or `npm run lint:fix` for the whole tree).
3. If the fix rewrites files, `git add` them into the same commit.
4. Do not push until those files are clean of `prettier/prettier` and other **errors**.

Do not rely on CI to catch formatting.
