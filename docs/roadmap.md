# Roadmap

Living plan for os-canvas-engine. Status: `todo` | `building` | `done`.

User-visible features, in a rough order. The order is orientative — it can change as
we learn on screen — and each feature is one branch, one PR. See **How we work** further down.

| Feature | Status | Code | Docs | ADR |
|---------|--------|------|------|-----|
| Repo scaffold, capability gate, GitHub Pages deploy | done | `apps/shell`, `.github/workflows/deploy-pages.yml` | [capability gate](./engineering-notes/2026-09-17-capability-gate.md), [pages](./engineering-notes/2026-09-17-github-pages.md) | [001](./decisions/001-shell-app-react-shadcn-base-ui.md) |
| A modal with a counter button, drawn through the canvas | done | `apps/shell` | [feature note](./features/counter-modal.md), [engineering note](./engineering-notes/2026-09-18-counter-modal.md) |[002](./decisions/002-react-renders-inside-the-canvas.md) |
| Draw the modal somewhere other than (0, 0) | todo | `apps/shell` | — | — |
| Drag the modal by its header | todo | `apps/shell` | — | — |
| Make it a window (title, close, the reference desktop's window chrome) | todo | `apps/shell` | — | — |
| A second window (overlap, click-to-raise, z-order) | todo | `apps/shell` | — | — |
| Open and close apps from a dock (Example, Settings, Example Two) | todo | `apps/shell` | — | — |
| The rest of the reference desktop (wallpaper, menu bar + fullscreen, boot splash, desktop icon grid, Settings background chooser) | todo | `apps/shell` | — | — |
| Beyond the reference: what canvas makes possible (pan/zoom the desktop, …) | todo | — | — | — |

Live preview: [0xfrann.github.io/os-canvas-engine](https://0xfrann.github.io/os-canvas-engine/) (deploys from `main` on every push).

## What each feature forces us to answer

- **Counter modal** — real DOM inside `<canvas>`, one `drawElementImage`, click → increment → repaint. Attribute names, the paint event / `requestPaint`. Installs React + shadcn/ui (Base UI): Dialog, Button.
- **Draw it elsewhere** — clicks land in the wrong place: who owns the element's position (drawn rect vs DOM rect).
- **Drag it** — position changes every frame: how repaint is driven (paint event vs a frame loop).
- **Window** — the reference desktop's `apps-window` chrome and CSS variables.
- **Second window** — first time a list of nodes ("document") earns its place, because two things need ordering.
- **Dock** — the reference's apps; one window at a time (as the reference does) vs many is decided here.
- **Rest of the reference desktop** — the shell is complete as a port.
- **Beyond the reference** — picked and designed when we get there, not now.

## How we work

- **Feature first.** A feature starts with its [feature note](./features/README.md): the need, then
  the smallest design that meets it, written before code. If designing it reveals a lower-level
  piece is needed, that piece is built inside the same feature and only as big as the feature needs.
- **Done means seen.** A feature is done when it's visible in Chrome Canary with
  `chrome://flags/#canvas-draw-element` on. The PR carries a screenshot (`pnpm screenshot`) and the
  feature note's **On screen** section says what was checked. Unit tests are welcome for pure
  logic, but never stand in for the browser here — no test shim implements this API.
- **Abstractions are extracted, not pre-built.** Everything lives in `apps/shell/src` until a
  feature has two consumers for the same code, or the engine needs to be separable at that point.
  Only then does a package under `packages/` appear.
- **No invented content.** What the shell shows comes from the reference desktop
  ([desktop-os-react-next](https://github.com/0xFrann/desktop-os-react-next)) or from an explicit
  decision. The counter modal is such a decision.
- **Docs:** ADRs in [`decisions/`](./decisions/) for real forks; dated learnings in
  [`engineering-notes/`](./engineering-notes/).

## Session log

| Date | What happened |
|------|----------------|
| 2026-09-17 | Repo scaffolded; tooling, docs skeleton, and workflow in place |
| 2026-09-17 | ADR 001: shell app uses React + shadcn/ui (Base UI) |
| 2026-09-17 | Capability gate: apps/shell (Vite + React) gates on `drawElementImage` support |
| 2026-09-17 | GitHub Pages deploy wired up (deploy-pages workflow, Vite base path) |
| 2026-09-17 | First attempt, layer by layer: document, camera, hit-testing, renderer packages (PRs #4–#7). Rendered on screen only at the very end, with one interaction wired |
| 2026-09-18 | Reset to the CI commit. Roadmap rewritten around features; packages removed; browser lessons kept in an [engineering note](./engineering-notes/2026-09-18-reset-to-feature-roadmap.md); `pnpm screenshot` kept |
| 2026-09-18 | Counter modal drawn through the canvas (React + shadcn/Base UI + Tailwind installed). Chrome fires `paint` by itself on child changes; React needs `layoutsubtree=""` not `{true}`; Base UI needs a Portal with `container` |
| 2026-09-18 | ADR 002: React renders content directly inside the canvas; portals target the drawable mount |
