# Roadmap

Living plan for os-canvas-engine. Status: `todo` | `building` | `done`.

User-visible features, in a rough order. The order is orientative — it can change as
we learn on screen — and each feature is one branch, one PR. See **How we work** further down.

| Feature | Status | Code | Docs | ADR |
|---------|--------|------|------|-----|
| Repo scaffold, capability gate, GitHub Pages deploy | done | `apps/shell`, `.github/workflows/deploy-pages.yml` | [capability gate](./engineering-notes/2026-09-17-capability-gate.md), [pages](./engineering-notes/2026-09-17-github-pages.md) | [001](./decisions/001-shell-app-react-shadcn-base-ui.md) |
| A modal with a counter button, drawn through the canvas | done | `apps/shell` | [feature note](./features/counter-modal.md), [engineering note](./engineering-notes/2026-09-18-counter-modal.md) |[002](./decisions/002-react-renders-inside-the-canvas.md) |
| Draw the modal somewhere other than (0, 0) | done | `packages/engine`, `packages/react`, `apps/shell` | [feature note](./features/modal-position.md) | [003](./decisions/003-engine-is-a-library-plugged-into-react.md) |
| A window with a draggable header (the reference desktop's window chrome) | done | `packages/engine`, `packages/react`, `apps/shell` | [feature note](./features/window-drag.md), [engineering note](./engineering-notes/2026-09-18-drag-repaint.md) | [004](./decisions/004-window-chrome-belongs-to-the-desktop.md) |
| A second window (overlap, click-to-raise, z-order) | todo | `apps/shell` | — | — |
| Open and close apps from a dock (Example, Settings, Example Two) | todo | `apps/shell` | — | — |
| The rest of the reference desktop (wallpaper, menu bar + fullscreen, boot splash, desktop icon grid, Settings background chooser) | todo | `apps/shell` | — | — |
| Beyond the reference: what canvas makes possible (pan/zoom the desktop, …) | todo | — | — | — |

Live preview: [0xfrann.github.io/os-canvas-engine](https://0xfrann.github.io/os-canvas-engine/) (deploys from `main` on every push).

## What each feature forces us to answer

- **Counter modal** — real DOM inside `<canvas>`, one `drawElementImage`, click → increment → repaint. Attribute names, the paint event / `requestPaint`. Installs React + shadcn/ui (Base UI): Dialog, Button.
- **Draw it elsewhere** — clicks land in the wrong place: who owns the element's position (drawn rect vs DOM rect).
- **Window with a draggable header** — position changes every frame: how repaint is driven (paint
  event vs a frame loop). And who owns a window: the desktop provides the chrome, the app fills a
  content slot, so apps can never make things draggable. Ports the reference desktop's `apps-window`
  chrome and CSS variables.
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
- **The engine is a library, the desktop is a React app.** `packages/engine` (`@os-canvas/engine`)
  is plain TypeScript with an imperative API and no React; `packages/react` (`@os-canvas/react`)
  is the thin binding; `apps/shell` is the desktop, which initializes the engine and renders
  everything on screen, with React apps under `apps/shell/src/apps/<Name>/`
  ([ADR 003](./decisions/003-engine-is-a-library-plugged-into-react.md)).
  Anything else is extracted when a feature needs it, not before.
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
| 2026-09-18 | Modal drawn at a position: Chrome 153 keeps hit-testing the mount at (0, 0); the engine writes the returned DOMMatrix to the element's transform (Chrome's documented idiom). `drawElementImage` takes backing-store coordinates, so no `ctx.scale(dpr)`. ADR 003: the engine is a library (`packages/engine`), the desktop a React app that plugs it in |
| 2026-09-18 | Modal dragged by its header: the engine owns the gesture (`item.addDragHandle`) and the position; repaint stays driven by Chrome's `paint` event with a dirty flag, no frame loop — Chrome coalesces pointer moves to about one per frame by itself. A ref object never reaches a portalled handle; the binding hands out a callback ref |
| 2026-09-18 | The modal became a window: chrome (header, close, the reference's `apps-window` look) belongs to the desktop's `Window` component, apps get a content slot, and the Base UI Dialog is gone. Header layout is macOS-style — controls top left, app's area with the title to the right of them, every empty pixel drags. The engine ignores presses on interactive elements, so the close button works inside the handle. ADR 004 |
