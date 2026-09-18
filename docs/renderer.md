# Renderer

## What it is

HTML-in-Canvas paint for document nodes. Package: `@os-canvas/renderer` (`createRenderer`).
Reads `@os-canvas/document` and `@os-canvas/camera`; owns the canvas's drawable DOM mounts;
does not own window state.

## Why it exists

Same structure-vs-paint boundary as the base project: the document says *what* is on screen,
the renderer says *where the pixels go*. What's different here is that "pixels" are
`drawElementImage` snapshots of real DOM, so the renderer also has a DOM-lifecycle job the base
project's `fillRect` renderer never had — see [ADR 004](./decisions/004-renderer-owns-mounts-host-owns-content.md).

## How it works here

- **`createRenderer({ canvas, doc, camera, background?, onMount?, onUnmount? })`** opts the canvas
  into laying out its children — both `content="drawable"` (explainer / Chromium main) *and* the
  older boolean `layoutsubtree` (what shipped Chrome 153 actually honors; Chromium reads `content`
  first and falls back) — and returns `{ render, syncMounts, resize, getMount, dispose }`.
- **Mounts.** One `<div drawable data-node-id="…">` per node, appended as a direct child of the
  canvas. The renderer creates it, sizes it (`width`/`height` in CSS px = the node's world size),
  removes it when the node is deleted, and never touches what's inside. The host fills it in
  `onMount` (the shell app will mount a React root there) and tears down in `onUnmount`.
- **`render()`** = `syncMounts()` → reset transform to the device-pixel-ratio scale → `clearRect`
  → optional background fill → for each node in `paintOrder(doc)`, `drawElementImage(mount, x, y, w, h)`.
  - `anchor: "world"` (windows): `x,y` via `worldToScreen`, `w,h` via `worldSizeToScreen` — zoom is
    a draw-time scale, the mount's layout size never changes with zoom.
  - `anchor: "screen"` (taskbar): raw `x,y,w,h`. The camera is not consulted ([ADR 002](./decisions/002-node-anchor-mode.md)).
  - `state: "minimized"`: not drawn. Its mount stays in the DOM (so the host's component state
    survives un-minimizing) but is set `inert` + `aria-hidden="true"` so keyboard focus and
    assistive tech can't land in something invisible.
- **Hit-testing geometry is CSS, not the API's.** Shipped Chrome 153 has no `updateElementGeometry`;
  `drawElementImage` *returns* the transform it recorded but never applies it to DOM hit-testing,
  so every mount would keep answering pointer events at the canvas origin (measured: all three
  mounts reported a `(0, 0)` client rect and a click in one window selected text in another). The
  renderer instead sets each mount's `transform: translate(x, y) scale(zoom)` (origin `0 0`) and
  `z-index` = paint index. Snapshots are recorded *before* CSS transforms, so the drawn pixels are
  untouched, while the mount's hit-test box and a11y geometry land exactly where it's drawn.
  Verified with `elementFromPoint` at zoom 1 and 1.5 and with a real mouse click on a close button.
- **Paint order** lives in `@os-canvas/document` as `paintOrder(doc)` / `comparePaintOrder`,
  shared with `@os-canvas/hit-testing` so what's drawn on top is exactly what gets picked. Order:
  world nodes by `zIndex`, then screen nodes by `zIndex`.
- **`resize(cssWidth, cssHeight, dpr)`** sizes the backing store to `css × dpr` and `render` applies
  `setTransform(dpr, 0, 0, dpr, 0, 0)`, so every coordinate the renderer deals in is a CSS pixel.
  The host wires a `ResizeObserver` (the WICG explainer's own pattern).
- **First frame after mounting.** `drawElementImage` throws `InvalidStateError` ("No cached paint
  record for element") until the browser has recorded a drawable's first snapshot, which can't
  happen in the same task the element was inserted. `render` catches exactly that error — matched
  on name *and* message, because the same error name also reports real misconfiguration — calls
  `canvas.requestPaint()`, and keeps drawing the other nodes. Any other error is rethrown.
- **Typings.** `src/types/html-in-canvas.ts` declares `drawElementImage`, `content`, `onpaint`,
  `requestPaint`, and the `paint` event globally (TypeScript's DOM lib doesn't have them yet), and
  exports `supportsHtmlInCanvas()` — the capability gate `apps/shell` now imports instead of
  keeping its own copy.

- **Where it's wired up.** `apps/shell/src/Desktop.tsx` seeds the reference desktop's two example
  apps (`example`, `exampletwo` — see `ContentKind`) plus the taskbar, mounts a React root into each
  drawable via `onMount`, drives `render()` from the canvas `paint` event, and re-pins the taskbar
  from a `ResizeObserver`. That's the placeholder frame loop until Step 6. `WindowContent` is the
  reference `AppsWindow` (header with centered title + close) around the reference app components.
  In dev, `globalThis.osCanvas` exposes `{ camera, canvas, doc, renderer }` so `pnpm screenshot`
  and the console can drive it (e.g. set `camera.zoom`, then `canvas.requestPaint()`).

## What I would do differently

- Should have wired it into the shell and looked at it *before* opening the PR. The first real
  run showed a blank desktop: shipped Chrome wanted `layoutsubtree`, the renderer only set
  `content="drawable"`, and the overly broad `InvalidStateError` catch turned that config error into
  a silent `requestPaint` busy-loop. Unit tests against fakes can't catch either. See the
  [engineering note](./engineering-notes/2026-09-17-renderer.md).
- Also shipped invented demo content (a clock, an "about" blurb) instead of what the reference
  desktop actually has. Replaced with the reference's apps; `ContentKind` now mirrors its
  `APPS_DATA`. The rule: no made-up apps, kinds, or copy — take it from the reference or ask.

## Open questions

- [ ] `state: "maximized"` is currently drawn at whatever rect the document holds. Should the
      renderer own "fill the viewport in screen space," or does the shell app just write a
      screen-anchored rect into the node? Left to Step 7.
- [ ] `paint` vs `requestAnimationFrame`: HTML-in-Canvas fires `paint` on the canvas whenever a
      drawable's snapshot changes (a clock ticking inside a window). The runtime (Step 6) needs to
      decide whether `paint` *is* the frame loop or feeds one.
- [ ] Viewport culling: every non-minimized node is drawn each frame. Fine for a handful of windows.
- [ ] Ink overflow: the window's `drop-shadow` is clipped to the mount's border box (visible as a
      faint rectangle around each window). The API's source-rect outsets exist for exactly this;
      alternatively pad the mount and draw the chrome inset.
- [ ] Once Chrome ships `updateElementGeometry` / applies `drawElementImage`'s transform to hit
      testing, the CSS-transform workaround can go (or stay as a belt-and-braces fallback).
- [ ] The reference desktop has a left dock and a top menu bar, not a bottom taskbar. The
      `taskbar` node predates this PR; whether it becomes dock + menu bar is a Step 7 decision.

## References

- [ADR 004: renderer owns mounts, host owns content](./decisions/004-renderer-owns-mounts-host-owns-content.md)
- [ADR 001: shell app stack](./decisions/001-shell-app-react-shadcn-base-ui.md) — where this ownership split was first called out
- [WICG HTML-in-Canvas explainer](https://github.com/WICG/html-in-canvas)
- Base project: [renderer.md](https://github.com/0xFrann/interactive-canvas-engine/blob/main/docs/renderer.md) — the `fillRect` version this replaces
