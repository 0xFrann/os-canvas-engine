# 2026-09-17 — GitHub Pages deploy

Wired `apps/shell` to deploy to GitHub Pages on every push to `main`, via `actions/deploy-pages`
rather than a `gh-pages` branch — no extra branch to keep in sync, and deploys show up as their
own environment in the repo's Actions/Environments tabs.

One easy-to-miss detail: GitHub Pages serves a project site under `/<repo>/`, not `/`, so
`vite.config.ts` only sets `base: "/os-canvas-engine/"` for production builds — the dev server
still needs to serve at `/`, or local `pnpm dev` breaks.

Since there's still no fallback renderer, most visitors to the live preview will see the
"unsupported browser" screen until they're on Chrome Canary with the flag — that's expected,
not a bug.
