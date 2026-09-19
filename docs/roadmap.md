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
| Multiple windows, opened from a dock (overlap, click-to-raise, close) | done | `packages/engine`, `packages/react`, `apps/shell` | [feature note](./features/multiple-windows.md), [engineering note](./engineering-notes/2026-09-18-overlap-hit-order.md) | [005](./decisions/005-draw-order-lives-in-the-engine.md), [006](./decisions/006-the-dock-is-chrome-over-the-canvas.md) |
| An active window (Tab stays inside the front one, Ctrl+` switches, focus follows) | done | `packages/engine`, `packages/react`, `apps/shell` | [feature note](./features/active-window.md), [engineering note](./engineering-notes/2026-09-18-inert-and-keyboard-confinement.md) | [007](./decisions/007-active-is-the-front-window.md) |
| A wallpaper the user can change (the engine draws it; Settings chooses it; windows get viewport-relative sizes) | done | `packages/engine`, `packages/react`, `apps/shell` | [feature note](./features/wallpaper.md), [engineering note](./engineering-notes/2026-09-18-wallpaper-in-the-canvas.md) | [008](./decisions/008-the-engine-draws-the-background.md) |
| An animated wallpaper | todo | — | — | — |
| The rest of the reference desktop (menu bar + fullscreen, boot splash, desktop icon grid, Example Two) | todo | `desktop`, `apps` | — | — |
| Beyond the reference: what canvas makes possible (pan/zoom the desktop, …) | todo | — | — | — |

Live preview: [0xfrann.github.io/os-canvas-engine](https://0xfrann.github.io/os-canvas-engine/) (deploys from `main` on every push).

## What each feature forces us to answer

- **Counter modal** — real DOM inside `<canvas>`, one `drawElementImage`, click → increment → repaint. Attribute names, the paint event / `requestPaint`. Installs React + shadcn/ui (Base UI): Dialog, Button.
- **Draw it elsewhere** — clicks land in the wrong place: who owns the element's position (drawn rect vs DOM rect).
- **Window with a draggable header** — position changes every frame: how repaint is driven (paint
  event vs a frame loop). And who owns a window: the desktop provides the chrome, the app fills a
  content slot, so apps can never make things draggable. Ports the reference desktop's `apps-window`
  chrome and CSS variables.
- **Multiple windows from a dock** — two questions at once. Ordering: two overlapping windows need
  an ordered list of drawn items inside the engine, and *only* that — a named "document" object
  waits for a consumer outside the render loop (a menu bar showing the active app, minimize, a
  camera). Ownership: a dock means the desktop no longer knows in advance what it is holding, so
  which windows exist becomes React state while positions and order stay the engine's. Decided
  here: many windows at once, where the reference shows one; and the dock is chrome laid over the
  canvas, not something the engine draws.
- **An active window** — the first consumer of that ordered list outside the render loop, and the
  question ADR 005 left open: are "in front" and "active" two things or one? One — so there is no
  new state anywhere. Which makes the keyboard inside the scene the engine's (Tab confined to the
  front item, focus following it when it changes) and leaves the desktop only the choice of *which
  key* switches windows, because a shortcut is OS policy. The list grew one operation, not a
  document.
- **A wallpaper the user can change** — the first thing the engine draws that is not a DOM element,
  so it asks what the canvas is *for*: the dock said chrome is not drawn, and the pixel behind the
  windows says the surface is. It also makes the engine draw an image, which splits loading (the
  host's) from fitting (the engine's), and gives Settings the first thing an app asks the desktop
  for — a setting it is not allowed to change itself. Per-app window sizes come with it, because
  Settings is the app that needs one, and sizes relative to the viewport are what force the desktop
  to work out where a window opens instead of hard-coding a corner.
- **An animated wallpaper** — the first thing that wants a frame after nothing happened: idle has
  been 0 paints per second since the drag, and this is what decides whether that property is a rule
  or a default. Designed when we get there.
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
  is the thin binding; `desktop/` (`@os-canvas/desktop`) is the OS host, which initializes the
  engine and renders everything on screen; the programs it runs are `apps/` (`@os-canvas/apps`,
  one folder each under `apps/src/`), and the shadcn components they share are `packages/ui`
  (`@os-canvas/ui`). Dependencies go one way: apps → ui; desktop → react, ui, apps; nothing imports
  the desktop, and apps never import the binding or the engine
  ([ADR 003](./decisions/003-engine-is-a-library-plugged-into-react.md),
  [ADR 009](./decisions/009-the-desktop-is-not-an-app.md)). Rows above that say `apps/shell` were
  written before the move.
  Anything else is extracted when a feature needs it, not before.
- **No invented content.** What the shell shows comes from the reference desktop
  ([desktop-os-react-next](https://github.com/0xFrann/desktop-os-react-next)) or from an explicit
  decision. The counter modal is such a decision. The reference is the source of truth for *what
  exists and how it behaves*, not for *how it looks*: the look is this project's own, built from
  Tailwind, shadcn/Base UI and lucide.
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
| 2026-09-18 | Two overlapping windows: the engine's items became an ordered list drawn back to front, with `item.raise()` and a raise on `pointerdown`. Draw order does not reach hit-testing: the mounts are static siblings, so Chrome hit-tests them in DOM order and the engine has to write `z-index` (plus `position: relative`) alongside the transform. Two windows cost the same paints as one; idle stays at 0. ADR 005. The second window's content is the reference's Example app, ported as it is |
| 2026-09-18 | A dock opens them, and the feature became *multiple windows*: which windows exist is React state in the desktop, positions and draw order stay in the engine, and the only new binding is `<Drawable ref>` handing back the `DrawableItem` so the dock can `raise()` a window nobody is pointing at. `packages/engine` unchanged. The close button is finally wired. ADR 006: the dock is chrome laid over the canvas, not a drawable — hovering it costs the canvas 0 paints. The reference desktop is the source of truth for what exists and how it behaves, not for how it looks: the dock's look is this project's own (Tailwind, shadcn/Base UI tooltip, lucide icons), after a first pass that ported its SCSS was thrown away |
| 2026-09-18 | An active window: active *is* the front one, so no new state — Tab is confined to it and wraps, Ctrl+` cycles (`code`, not `key`), and focus follows the front window onto its mount rather than onto a control, because every window's first control is its close button. `inert` was tried on screen first and rejected: it leaves the snapshot byte-identical but takes a buried window out of hit-testing, so pressing it stops raising it. The engine handles `keydown` on the document and gained one method; which key it is stays the desktop's, and `<CanvasSurface ref>` now hands back the engine so `App` can bind it. ADR 007. No active-window marker — what should show it, if anything, is still undecided |
| 2026-09-18 | A wallpaper the user can change, and the desktop stopped having a CSS background: the engine fills the canvas under the items, with a color or an image fitted to cover, and that is one new method and one step of the render pass — not an item, not a loader, not a model. ADR 008. Loading and remembering are the desktop's; the Settings app only asks it, through a small context, which is ADR 004 holding for something that is not a window. Per-app window sizes came with it, `clamp()` of the viewport rather than the reference's `vw`/`vh` numbers, so a window is the width it has always been at 1280 and still whole at 800; the first window is centred and the rest cascade from *its* corner, after cascading from each window's own centre put two windows 5px apart. Measured: a change costs the engine 1 paint, the same one again 0, idle stays 0/s with an image on screen, a resize re-lays out for 1 paint with no engine call, and the first render of a cold load already has the wallpaper on it |
| 2026-09-19 | Workspace layout: the desktop is not an app. `apps/shell` became `desktop/` (`@os-canvas/desktop`), the programs became one package, `apps/` (`@os-canvas/apps`), and the shadcn components `packages/ui` (`@os-canvas/ui`); dependencies go one way and the theme stays in the desktop, with `@source` lines for the other two. The contract an app has with the desktop (`useDesktop`) lives with the apps, so Settings needs nothing from the host's package. No behaviour change: the built CSS is byte-identical. ADR 009 |
